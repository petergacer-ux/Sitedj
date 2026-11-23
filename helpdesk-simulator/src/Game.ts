/**
 * Chef d'orchestre : relie le rendu 3D, les contrôles, le monde, l'état global,
 * le HUD, les menus et les interfaces « logicielles ».
 *
 * Modes de jeu :
 *  - title   : écran d'accueil
 *  - playing : contrôle à la première personne (souris verrouillée)
 *  - app     : une interface HTML est ouverte (GLPI, poste Windows…) — souris libre
 *  - dialog  : conversation avec un PNJ — souris libre
 *  - rack    : vue rapprochée de la baie — souris libre
 *  - resume  : « cliquez pour reprendre » (après fermeture au clavier)
 *  - paused  : menu pause
 *  - dayend  : bilan de fin de journée
 */
import * as THREE from 'three';
import { buildHelpdeskPro } from './apps/HelpdeskPro';
import { AppWindow, type AppOptions } from './apps/AppWindow';
import { buildUserDesktop } from './apps/UserDesktop';
import { sound } from './audio/Sound';
import { SPOTS, type DeskDef } from './data/map';
import { GREETINGS, type UserDef } from './data/users';
import { FirstPersonController } from './engine/FirstPersonController';
import { InteractionSystem } from './engine/InteractionSystem';
import { Renderer } from './engine/Renderer';
import { formatTime } from './state/clock';
import { GameState } from './state/GameState';
import { applySave, hasSave, readSave, writeSave } from './state/save';
import { loadSettings, saveSettings, type Settings } from './state/settings';
import { DialogBox } from './ui/DialogBox';
import { el } from './ui/dom';
import { Hud } from './ui/Hud';
import { MapView } from './ui/MapView';
import { Menus } from './ui/Menus';
import { Notifications } from './ui/Notifications';
import { TouchControls, isTouchDevice } from './ui/TouchControls';
import type { Door } from './world/Door';
import type { RackBuild } from './world/furniture';
import { World, type FocusView, type WorldActions } from './world/World';

type Mode = 'title' | 'playing' | 'app' | 'dialog' | 'rack' | 'resume' | 'paused' | 'dayend';

export class Game {
  readonly state = new GameState();
  private settings: Settings = loadSettings();
  private renderer: Renderer;
  private controller: FirstPersonController;
  private interactions = new InteractionSystem();
  private world: World;
  private hud: Hud;
  private toasts: Notifications;
  private menus: Menus;
  private map: MapView;
  private dialog: DialogBox;
  private app: AppWindow;
  private fps: HTMLElement;

  private mode: Mode = 'title';
  private expectingUnlock = false;
  private closingByKey = false;
  private lastPrompt: string | null = null;
  private timer = new THREE.Timer();
  private elapsed = 0;
  private frames = 0;
  private fpsTimer = 0;
  private rackHover: HTMLElement;
  private rackView: RackBuild | null = null;
  /** Mode tactile (iPad) : pas de Pointer Lock, joystick + boutons. */
  private readonly touchMode = isTouchDevice();
  private touch: TouchControls | null = null;
  private rackTouchY: number | null = null;

  constructor(container: HTMLElement) {
    const gameLayer = el('div', { class: 'game-layer' });
    const uiLayer = el('div', { class: 'ui-layer' });
    container.append(gameLayer, uiLayer);

    this.renderer = new Renderer(gameLayer, this.settings.quality, this.settings.fov);
    this.controller = new FirstPersonController(this.renderer.camera, this.renderer.canvas);

    this.hud = new Hud(uiLayer);
    this.toasts = new Notifications(uiLayer);
    this.map = new MapView(uiLayer);
    this.dialog = new DialogBox(uiLayer);
    this.app = new AppWindow(uiLayer);
    this.rackHover = el('div', { class: 'rack-tooltip hidden' });
    this.fps = el('div', { class: 'fps hidden' });
    uiLayer.append(this.rackHover, this.fps);
    if (this.touchMode) {
      document.body.classList.add('touch');
      this.touch = new TouchControls(uiLayer, {
        interact: () => {
          const target = this.interactions.hovered;
          if (this.mode === 'playing' && target && !this.map.isOpen) target.onInteract();
        },
        toggleCrouch: () => (this.controller.crouching = !this.controller.crouching),
        toggleMap: () => {
          this.map.toggle();
          sound.play('click');
        },
        pause: () => {
          if (this.mode === 'playing') this.pause();
        },
        look: (dx, dy) => this.controller.look(dx, dy),
      });
      this.controller.virtualMove = this.touch.move;
    }
    this.menus = new Menus(
      uiLayer,
      this.settings,
      {
        onStart: (cont) => this.start(cont),
        onResume: () => this.requestLock(),
        onSave: () => this.save(),
        onLoad: () => this.load(),
        onSettings: (s) => this.applySettings(s),
        onQuitToTitle: () => this.quitToTitle(),
        onNextDay: () => this.nextDay(),
      },
      hasSave,
    );

    // Monde 3D
    this.world = new World(this.interactions, this.makeActions());
    this.world.build();
    this.renderer.scene.add(this.world.root);
    this.interactions.occluders = this.world.occluders;
    this.resetPlayer();

    this.bindEvents();
    this.applySettings(this.settings);
    this.hud.update(this.state);
    this.hud.setVisible(false);
    this.renderer.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------------ événements

  private bindEvents(): void {
    const controls = this.controller.controls;
    controls.addEventListener('lock', () => this.enterPlaying());
    controls.addEventListener('unlock', () => {
      this.controller.releaseKeys();
      if (this.expectingUnlock) {
        this.expectingUnlock = false;
        return;
      }
      if (this.mode === 'playing') this.pause();
    });
    document.addEventListener('pointerlockerror', () => {
      // Le navigateur refuse parfois le verrouillage (trop tôt après Échap) : on propose de recliquer.
      if (this.mode !== 'title' && this.mode !== 'paused' && this.mode !== 'dayend') {
        this.mode = 'resume';
        this.menus.showResume();
      }
    });

    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });
    this.renderer.canvas.addEventListener('mousemove', (e) => this.onRackMouseMove(e));
    this.renderer.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Vue baie au doigt : glisser verticalement pour monter / descendre, toucher pour identifier.
    this.renderer.canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'rack' || e.pointerType === 'mouse') return;
      this.rackTouchY = e.clientY;
      this.onRackMouseMove(e);
    });
    this.renderer.canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'rack' || this.rackTouchY === null || !this.rackView) return;
      this.controller.nudgeFocus((e.clientY - this.rackTouchY) * 0.004, this.rackView.minY, this.rackView.maxY);
      this.rackTouchY = e.clientY;
    });
    window.addEventListener('pointerup', () => (this.rackTouchY = null));
    this.hud.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-act="exit-focus"]')) this.exitRack(false);
    });

    this.state.events.on('toast', (t) => {
      this.toasts.show(t.text, t.kind, t.title);
      if (t.kind === 'ticket') sound.play('ticket');
      else if (t.kind === 'warn' || t.kind === 'error') sound.play('notify');
    });
    this.state.events.on('statsChanged', () => this.hud.update(this.state));
    this.state.events.on('minute', (m) => this.world.screens.tick(m));
    this.state.events.on('dayEnded', () => this.endDay());
  }

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (this.mode === 'app') {
        this.closingByKey = true;
        this.app.close();
      } else if (this.mode === 'dialog') this.closeDialog(true);
      else if (this.mode === 'rack') this.exitRack(true);
      return;
    }
    if (e.repeat) return;
    if (this.mode !== 'playing') return;
    if (key === 'e') {
      const target = this.interactions.hovered;
      if (target && !this.map.isOpen) target.onInteract();
    } else if (key === 'm' || e.code === 'Semicolon') {
      this.map.toggle();
      sound.play('click');
    } else if (key === 'h') {
      this.settings.showHints = this.hud.toggleHints();
      saveSettings(this.settings);
    }
  }

  private onWheel(e: WheelEvent): void {
    if (this.mode === 'rack' && this.rackView) {
      this.controller.nudgeFocus(-Math.sign(e.deltaY) * 0.1, this.rackView.minY, this.rackView.maxY);
    }
  }

  /** En vue baie, survol à la souris : nom de l'équipement. */
  private onRackMouseMove(e: MouseEvent): void {
    if (this.mode !== 'rack' || !this.rackView) {
      this.rackHover.classList.add('hidden');
      return;
    }
    const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.renderer.camera);
    const hit = ray.intersectObject(this.rackView.root, true).find((h) => h.object.name.startsWith('face:'));
    const names: Record<string, string> = {
      'face:PP-01': 'Panneau de brassage PP-01 — 24 ports vers les prises murales',
      'face:SW-01': 'Switch SW-01 — 24 ports, manageable (CLI)',
      'face:SW-02': 'Switch SW-02 — 24 ports, manageable (CLI)',
      'face:RT-FW-01': 'Routeur / pare-feu RT-FW-01',
      'face:SRV-01 (AD/DNS/DHCP/Fichiers)': 'Serveur SRV-01 — AD, DNS, DHCP, fichiers',
      'face:brush': 'Passe-câbles à brosse',
      'face:NAS-01 (Sauvegardes)': 'NAS-01 — sauvegardes nocturnes',
    };
    if (hit && names[hit.object.name]) {
      this.rackHover.textContent = names[hit.object.name];
      this.rackHover.style.left = `${e.clientX + 14}px`;
      this.rackHover.style.top = `${e.clientY + 14}px`;
      this.rackHover.classList.remove('hidden');
    } else this.rackHover.classList.add('hidden');
  }

  // ------------------------------------------------------------------ modes

  /** Reprise du contrôle à la première personne. */
  private enterPlaying(): void {
    this.mode = 'playing';
    this.menus.hideAll();
    this.hud.setVisible(true);
    this.hud.setCrosshairVisible(true);
  }

  private requestLock(): void {
    sound.unlock();
    if (this.touchMode) {
      // Sur tablette, pas de verrouillage de la souris : on reprend directement.
      this.enterPlaying();
      return;
    }
    try {
      const p = this.controller.controls.domElement as HTMLElement;
      const r = p.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') {
        r.catch(() => {
          this.mode = 'resume';
          this.menus.showResume();
        });
      }
    } catch {
      this.mode = 'resume';
      this.menus.showResume();
    }
  }

  /** Libère la souris sans déclencher le menu pause. */
  private releasePointer(): void {
    if (this.touchMode) return;
    if (this.controller.isLocked) {
      this.expectingUnlock = true;
      this.controller.controls.unlock();
    }
  }

  private start(continueGame: boolean): void {
    sound.unlock();
    if (continueGame) this.load(true);
    else {
      this.state.clock.restore(1, 8 * 60 + 30);
      this.state.xp = 0;
      this.state.energy = 100;
      this.state.satisfaction = 80;
      this.state.day = GameState.emptyDay();
      this.resetPlayer();
      this.world.doors.forEach((d) => {
        d.setOpen(false);
        d.locked = !!d.def.locked;
      });
      this.hud.update(this.state);
      setTimeout(() => {
        this.state.toast('Bienvenue au service informatique ! Votre poste est juste devant vous. Faites le tour de l’étage (M pour le plan).', 'info', 'Bernard (chef de service)');
      }, 600);
    }
    this.requestLock();
  }

  private pause(): void {
    this.mode = 'paused';
    this.map.close();
    this.hud.setVisible(false);
    this.menus.showPause();
  }

  private quitToTitle(): void {
    this.mode = 'title';
    this.menus.showStart();
  }

  private resetPlayer(): void {
    this.controller.setPose(SPOTS.spawn.x, SPOTS.spawn.z, SPOTS.spawn.yaw, -0.12);
  }

  // ------------------------------------------------------------------ interfaces

  /** S'approche de l'écran puis ouvre une interface HTML. */
  private async openApp(view: FocusView, opts: AppOptions, build: () => HTMLElement): Promise<void> {
    if (this.mode !== 'playing') return;
    this.mode = 'app';
    this.interactions.clear();
    this.hud.setCrosshairVisible(false);
    this.map.close();
    this.releasePointer();
    sound.play('open');
    await this.controller.focusOn(view.pos, view.look, 0.55);
    if (this.mode !== 'app') return;
    this.app.open(opts, build(), () => this.afterOverlayClosed());
  }

  /** Après fermeture d'une interface : retour caméra, puis reprise du contrôle. */
  private afterOverlayClosed(): void {
    sound.play('close');
    const byKey = this.closingByKey;
    this.closingByKey = false;
    void this.controller.restore();
    if (this.mode === 'dayend') return;
    if (byKey) {
      // Échap n'est pas un « geste utilisateur » pour le Pointer Lock : il faut recliquer.
      this.mode = 'resume';
      this.menus.showResume();
    } else this.requestLock();
  }

  private async openRack(rack: RackBuild): Promise<void> {
    if (this.mode !== 'playing') return;
    this.mode = 'rack';
    this.rackView = rack;
    this.interactions.clear();
    this.hud.setCrosshairVisible(false);
    this.releasePointer();
    const y = 1.5;
    const pos = rack.front.clone().addScaledVector(rack.frontNormal, 1.0).setY(y);
    const look = rack.front.clone().setY(y - 0.08);
    sound.play('open');
    this.hud.setFocusHint(
      this.touchMode
        ? '<b>Vue baie</b> · Glissez pour monter / descendre · Touchez un équipement pour l’identifier · <button class="btn small" data-act="exit-focus">✕ Quitter</button>'
        : '<b>Vue rapprochée de la baie</b> · Molette : monter / descendre · Survolez un équipement pour l’identifier · <kbd>Échap</kbd> ou <button class="btn small" data-act="exit-focus">✕ Quitter</button>',
    );
    await this.controller.focusOn(pos, look, 0.7);
  }

  private exitRack(byKey: boolean): void {
    if (this.mode !== 'rack') return;
    this.rackView = null;
    this.rackHover.classList.add('hidden');
    this.hud.setFocusHint(null);
    sound.play('close');
    void this.controller.restore();
    if (byKey) {
      this.mode = 'resume';
      this.menus.showResume();
    } else this.requestLock();
  }

  private async talkTo(user: UserDef): Promise<void> {
    if (this.mode !== 'playing') return;
    this.mode = 'dialog';
    this.interactions.clear();
    this.hud.setCrosshairVisible(false);
    this.releasePointer();
    // On tourne la tête vers le PNJ.
    const npc = this.interactions.get(`npc:${user.id}`)?.object;
    if (npc) {
      const head = new THREE.Vector3();
      npc.getWorldPosition(head);
      const box = new THREE.Box3().setFromObject(npc);
      box.getCenter(head);
      head.y = box.max.y - 0.15;
      void this.controller.focusOn(this.renderer.camera.position.clone(), head, 0.35);
    }
    const greetings = GREETINGS[user.personality];
    const line = greetings[Math.floor(Math.random() * greetings.length)];
    const subtitle = `${user.service} · bureau ${user.desk}`;
    const bye = { text: 'Bonne journée !', action: () => this.closeDialog(false) };
    this.dialog.show(`${user.firstName} ${user.lastName}`, subtitle, line, [
      {
        text: 'Tout fonctionne bien sur votre poste ?',
        action: () =>
          this.dialog.show(`${user.firstName} ${user.lastName}`, subtitle, user.itLevel <= 2 ? 'Euh… je crois ? L’internet marche, en tout cas. Enfin, le Google.' : 'Oui, rien à signaler. Je ferai un ticket s’il y a un souci, promis.', [bye]),
      },
      {
        text: 'Je passe juste faire le tour des bureaux.',
        action: () => this.dialog.show(`${user.firstName} ${user.lastName}`, subtitle, 'D’accord ! Vous êtes le nouveau technicien, c’est ça ? Bienvenue !', [bye]),
      },
      bye,
    ]);
  }

  private closeDialog(byKey: boolean): void {
    if (this.mode !== 'dialog') return;
    this.dialog.hide();
    void this.controller.restore(0.3);
    if (byKey) {
      this.mode = 'resume';
      this.menus.showResume();
    } else this.requestLock();
  }

  // ------------------------------------------------------------------ actions du monde

  private makeActions(): WorldActions {
    return {
      useMyPc: (view) =>
        void this.openApp(view, { title: 'HelpDesk Pro — Gestion des tickets', icon: '🎫', theme: 'theme-glpi' }, () => buildHelpdeskPro(this.state)),
      useUserPc: (desk, view) => this.useUserPc(desk, view),
      inspectJack: (desk) => {
        sound.play('click');
        this.state.toast(`Prise ${desk.id} : le câble du ${desk.pcName} est branché. (Brassage et tests de câble à l’étape 2.)`, 'info', `Prise murale ${desk.id}`);
      },
      openRack: (rack) => void this.openRack(rack),
      inspectUps: () => this.state.toast('Sur secteur · Batterie 100 % · Autonomie estimée 25 min · Charge 38 %', 'ok', 'Onduleur 3000VA'),
      talkTo: (user) => void this.talkTo(user),
      phone: () => {
        sound.play('click');
        this.state.toast('Tonalité… Aucun appel en attente.', 'info', 'Téléphone — poste 2222');
      },
      shelf: () =>
        this.state.toast('Câbles RJ45 ×10 · Cordons de brassage ×12 · Souris ×4 · Claviers ×3 · Toners ×2 · Testeur de câble ×1 (inventaire complet à l’étape 6)', 'info', 'Stock matériel'),
      coffee: () => this.coffee(),
      copier: () => this.state.toast('Prêt. Bac 1 : A4 (plein) · Bac 2 : A3 (bas) · Toner noir 64 %', 'info', 'Copieur COPIEUR-ET2'),
      printer: (name) => this.state.toast('Prête · File d’attente vide · Toner 72 %', 'info', name),
      door: (door) => this.useDoor(door),
      tv: () => {
        const s = this.world.screens.get('tv-reunion');
        const on = s?.message !== 'Visio en cours — Comité de direction';
        this.world.screens.setState('tv-reunion', 'tv', on ? 'Visio en cours — Comité de direction' : 'Aucune visio en cours');
        sound.play('click');
      },
    };
  }

  private useUserPc(desk: DeskDef, view: FocusView): void {
    if (!desk.userId) {
      this.state.toast(`${desk.pcName} est éteint : poste non attribué (installation d’un nouveau poste à l’étape 6).`, 'warn', desk.pcName);
      return;
    }
    void this.openApp(view, { title: `${desk.pcName} — Session Windows`, icon: '🪟', theme: 'theme-windows' }, () => buildUserDesktop(desk, this.state.clock.minutes));
  }

  private useDoor(door: Door): void {
    if (door.locked) {
      if (this.state.hasBadge) {
        sound.play('badge');
        door.locked = false;
        const led = door.pivot.userData.badgeLed as THREE.Mesh | undefined;
        if (led) (led.material as THREE.MeshBasicMaterial).color.set(0x30ff60);
        this.state.toast('Badge accepté.', 'ok', door.def.sign);
      } else {
        sound.play('denied');
        this.state.toast('Accès refusé : badge requis.', 'error', door.def.sign);
        return;
      }
    }
    door.setOpen(!door.isOpen);
    sound.play('door');
  }

  private coffee(): void {
    const now = this.state.clock.minutes;
    if (now - this.state.lastCoffeeAt < 30) {
      this.state.toast('Vous venez d’en prendre un… Attendez un peu !', 'warn', 'Machine à café');
      return;
    }
    this.state.lastCoffeeAt = now;
    this.state.day.coffees++;
    sound.play('coffee');
    this.state.setEnergy(this.state.energy + 35);
    this.state.toast('Un bon café bien serré. Énergie +35 ⚡', 'ok', 'Machine à café');
  }

  // ------------------------------------------------------------------ journées / sauvegarde

  private endDay(): void {
    // Le mode passe à « dayend » AVANT de fermer les fenêtres, pour ne pas reprendre la main.
    this.mode = 'dayend';
    if (this.app.isOpen) this.app.close();
    if (this.dialog.isOpen) this.dialog.hide();
    this.hud.setFocusHint(null);
    this.rackView = null;
    void this.controller.restore(0.01);
    this.releasePointer();
    this.map.close();
    this.hud.setVisible(false);
    const d = this.state.day;
    this.save(true);
    const remark =
      d.coffees > 3 ? 'Doucement sur le café, il en faut pour tout le monde !' : 'Bonne première prise en main. Demain, les premiers tickets vont tomber, soyez prêt.';
    this.menus.showDayEnd(
      [
        { label: 'Tickets résolus', value: String(d.ticketsResolved) },
        { label: 'SLA respectés / dépassés', value: `${d.slaOk} / ${d.slaMissed}` },
        { label: 'Satisfaction moyenne', value: `${Math.round(this.state.satisfaction)} %` },
        { label: 'XP gagnée', value: `+${d.xpGained}` },
        { label: 'Cafés', value: String(d.coffees) },
        { label: 'Grade', value: this.state.levelName },
      ],
      remark,
      `Fin de la journée ${this.state.clock.day} — ${formatTime(this.state.clock.minutes)}`,
    );
  }

  private nextDay(): void {
    this.state.clock.nextDay();
    this.state.day = GameState.emptyDay();
    this.state.setEnergy(100);
    this.state.lastCoffeeAt = -999;
    this.resetPlayer();
    this.hud.update(this.state);
    this.requestLock();
  }

  private save(silent = false): void {
    const ok = writeSave(
      this.state,
      { x: this.controller.x, z: this.controller.z, yaw: this.controller.yaw, pitch: this.controller.pitch },
      this.world.doors.filter((d) => d.isOpen).map((d) => d.def.id),
    );
    if (!silent) this.state.toast(ok ? 'Partie sauvegardée.' : 'Impossible de sauvegarder (stockage indisponible).', ok ? 'ok' : 'error', 'Sauvegarde');
    this.menus.refreshContinue();
  }

  private load(silent = false): void {
    const data = readSave();
    if (!data) {
      if (!silent) this.state.toast('Aucune sauvegarde trouvée.', 'warn', 'Chargement');
      return;
    }
    applySave(this.state, data);
    this.controller.setPose(data.player.x, data.player.z, data.player.yaw, data.player.pitch);
    for (const d of this.world.doors) {
      const open = data.openDoors.includes(d.def.id);
      d.setOpen(open);
      if (open) d.locked = false;
    }
    this.world.screens.tick(this.state.clock.minutes);
    this.hud.update(this.state);
    if (!silent) this.state.toast(`Partie du jour ${data.day} chargée (${formatTime(data.minutes)}).`, 'ok', 'Chargement');
  }

  private applySettings(s: Settings): void {
    this.controller.sensitivity = s.sensitivity;
    this.controller.headBob = s.headBob;
    this.renderer.setFov(s.fov);
    this.renderer.applyQuality(s.quality);
    sound.setVolume(s.volume, s.muted);
    this.hud.setHintsVisible(s.showHints);
    this.fps.classList.toggle('hidden', !s.showFps);
    saveSettings(s);
  }

  // ------------------------------------------------------------------ boucle

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += dt;
    const live = this.mode === 'playing' || this.mode === 'app' || this.mode === 'dialog' || this.mode === 'rack';
    if (live) this.state.update(dt);

    this.controller.updateTween(dt);
    if (this.mode === 'playing' && !this.controller.focused) {
      this.controller.speedMultiplier = this.state.energy < 15 ? 0.7 : 1;
      this.controller.update(dt, this.world.colliders);
    }
    this.world.update(dt);

    const canInteract = this.mode === 'playing' && !this.map.isOpen && !this.controller.focused;
    const hovered = this.interactions.update(this.renderer.camera, canInteract);
    const prompt = canInteract ? (hovered?.label() ?? null) : null;
    if (prompt !== this.lastPrompt) {
      this.hud.setPrompt(prompt);
      this.lastPrompt = prompt;
    }
    this.hud.setCrouching(this.mode === 'playing' && this.controller.crouching);
    if (this.touch) {
      this.touch.setVisible(this.mode === 'playing');
      this.touch.setAction(prompt);
      this.touch.setCrouching(this.controller.crouching);
    }
    this.map.draw(this.controller.x, this.controller.z, this.controller.yaw, this.state.openTicketDesks, this.elapsed);

    this.renderer.render();

    // Compteur FPS
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      const info = this.renderer.renderer.info.render;
      this.fps.textContent = `${Math.round(this.frames / this.fpsTimer)} FPS · ${info.calls} draw calls`;
      this.frames = 0;
      this.fpsTimer = 0;
    }
  }
}
