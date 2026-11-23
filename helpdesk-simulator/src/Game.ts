/**
 * Chef d'orchestre : relie le rendu 3D, les contrôles, le monde, l'état global (réseau, bureautique,
 * tickets), le HUD, les menus et les interfaces « logicielles ».
 *
 * Modes de jeu :
 *  - title   : écran d'accueil
 *  - playing : contrôle à la première personne
 *  - app     : une interface HTML est ouverte (HelpDesk Pro, poste Windows, console…) — souris libre
 *  - dialog  : conversation (PNJ, téléphone, arrière du PC…) — souris libre
 *  - rack    : vue rapprochée de la baie — souris libre
 *  - resume  : « cliquez pour reprendre » (après fermeture au clavier)
 *  - paused  : menu pause
 *  - dayend  : bilan de fin de journée
 */
import * as THREE from 'three';
import { AppWindow, type AppOptions } from './apps/AppWindow';
import { buildHelpdeskPro } from './apps/HelpdeskPro';
import { RackController } from './apps/RackController';
import { buildStockWindow } from './apps/StockWindow';
import { buildSwitchConsole, resetCliSessions } from './apps/SwitchConsole';
import { buildUserDesktop } from './apps/UserDesktop';
import { sound } from './audio/Sound';
import { DESKS, MY_DESK, SPOTS, type DeskDef } from './data/map';
import { SCENARIOS, getScenario } from './data/scenarios';
import { GREETINGS, USERS, getUser, type UserDef } from './data/users';
import { FirstPersonController } from './engine/FirstPersonController';
import { InteractionSystem } from './engine/InteractionSystem';
import { Renderer } from './engine/Renderer';
import { Tutorial } from './game/Tutorial';
import { Network } from './network/Network';
import { createInitialNetwork } from './network/initial';
import { Office, createInitialOffice } from './sim/Office';
import type { ItemId } from './sim/types';
import { DAY_START, formatTime } from './state/clock';
import { GameState, LEVELS } from './state/GameState';
import { applySave, hasSave, readSave, writeSave } from './state/save';
import { loadSettings, saveSettings, type Settings } from './state/settings';
import { TicketSystem, absMinutes, type ResolveResult } from './tickets/TicketSystem';
import type { Channel, ScenarioDef, ScenarioTarget, Ticket } from './tickets/types';
import { DialogBox, type DialogChoice } from './ui/DialogBox';
import { el } from './ui/dom';
import { Hotbar } from './ui/Hotbar';
import { Hud } from './ui/Hud';
import { MapView } from './ui/MapView';
import { Menus } from './ui/Menus';
import { Notifications } from './ui/Notifications';
import { TouchControls, isTouchDevice } from './ui/TouchControls';
import type { Door } from './world/Door';
import { HeldItem } from './world/HeldItem';
import type { Rack3D } from './world/Rack3D';
import { World, type FocusView, type WorldActions } from './world/World';

type Mode = 'title' | 'playing' | 'app' | 'dialog' | 'rack' | 'resume' | 'paused' | 'dayend';

/** Appel téléphonique en attente (le téléphone sonne). */
interface PendingCall {
  sc: ScenarioDef;
  target: ScenarioTarget;
  /** Heure limite (ms) ; -1 = décroché. */
  until: number;
  lastRing: number;
}

const BOSS_TIPS = [
  'Traite d’abord les tickets en priorité « Très haute », puis ceux dont le SLA expire bientôt.',
  'Un utilisateur prévenu est un utilisateur patient : ajoute un suivi dans le ticket avant de te déplacer.',
  'Après une modification sur un switch, pense TOUJOURS à « copy running-config startup-config ».',
  'Une adresse en 169.254 ? Le DHCP n’a pas répondu : vérifie le port du switch (shutdown, VLAN).',
  '« Média déconnecté » : le physique d’abord ! Câble, prise, brassage, port du switch.',
  'Après un ajout dans un groupe AD, l’utilisateur doit rouvrir sa session pour en profiter.',
  'Ne clique jamais sur un lien suspect, même pour « vérifier ». Signale et bloque.',
  'Le testeur de câble est dans l’étagère, avec les câbles RJ45 neufs.',
];

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
  private hotbar: Hotbar;
  private held: HeldItem;
  private tutorial: Tutorial;
  private fps: HTMLElement;

  /** Moteur réseau : source de vérité du câblage, des switchs et des adresses IP. */
  readonly net = new Network(createInitialNetwork());
  /** AD, postes Windows, imprimantes, stock, prêts. */
  readonly office = new Office(this.net, createInitialOffice());
  readonly tickets: TicketSystem;

  private mode: Mode = 'title';
  private expectingUnlock = false;
  private closingByKey = false;
  private lastPrompt: string | null = null;
  private timer = new THREE.Timer();
  private elapsed = 0;
  private frames = 0;
  private fpsTimer = 0;
  private rackHover: HTMLElement;
  private rackCtl!: RackController;
  private readonly touchMode = isTouchDevice();
  private touch: TouchControls | null = null;
  private lastPointerType = 'mouse';
  private lockUnavailable = false;
  private lockPending = false;

  private pendingCall: PendingCall | null = null;
  private visitor: { ticket: number; user: string; until: number } | null = null;
  private lastEventDay = 0;
  private powerCutAt: number | null = null;
  private tutorialTicket: number | null = null;

  constructor(container: HTMLElement) {
    const gameLayer = el('div', { class: 'game-layer' });
    const uiLayer = el('div', { class: 'ui-layer' });
    container.append(gameLayer, uiLayer);

    this.renderer = new Renderer(gameLayer, this.settings.quality, this.settings.fov);
    this.renderer.scene.add(this.renderer.camera); // pour l'objet tenu en main
    this.controller = new FirstPersonController(this.renderer.camera, this.renderer.canvas);
    this.held = new HeldItem(this.renderer.camera);
    this.tickets = new TicketSystem(this.office, this.net);

    this.hud = new Hud(uiLayer);
    this.toasts = new Notifications(uiLayer);
    this.map = new MapView(uiLayer);
    this.dialog = new DialogBox(uiLayer);
    this.app = new AppWindow(uiLayer);
    this.hotbar = new Hotbar(uiLayer, () => this.held.set(this.hotbar.current));
    this.tutorial = new Tutorial(uiLayer, () => this.onTutorialDone());
    this.rackHover = el('div', { class: 'rack-tooltip hidden' });
    this.fps = el('div', { class: 'fps hidden' });
    uiLayer.append(this.rackHover, this.fps);
    if (this.touchMode) {
      document.body.classList.add('touch');
      this.touch = new TouchControls(uiLayer, {
        interact: () => this.interact(),
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
        onStart: (kind) => this.start(kind),
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
    this.world = new World(this.interactions, this.makeActions(), this.net, this.office);
    this.world.build();
    this.renderer.scene.add(this.world.root);
    this.interactions.occluders = this.world.occluders;
    this.patchLabels();
    this.world.syncNetwork();
    this.net.onChange(() => this.world.syncNetwork());
    this.office.onChange(() => {
      this.world.syncScreens();
      this.hotbar.render(this.office.state.inventory);
      this.held.set(this.hotbar.current);
    });
    this.tickets.onEvent((e) => this.onTicketEvent(e.type, e.ticket));
    this.rackCtl = new RackController(
      this.net,
      this.world.rack,
      this.renderer.camera,
      this.controller,
      this.hud,
      this.rackHover,
      (text, kind, title) => this.state.toast(text, kind, title),
      () => this.touchMode && !this.controller.isLocked && this.lastPointerType !== 'mouse',
      {
        usePatch: () => {
          if (this.office.state.stock.patch <= 0) return false;
          this.office.state.stock.patch--;
          return true;
        },
        returnPatch: () => this.office.state.stock.patch++,
        openConsole: (sw) => this.openSwitchConsole(sw),
        patchStock: () => this.office.state.stock.patch,
      },
    );
    this.resetPlayer();

    this.bindEvents();
    this.applySettings(this.settings);
    this.hotbar.render(this.office.state.inventory);
    this.hud.update(this.state);
    this.hud.setVisible(false);
    this.hotbar.setVisible(false);
    this.renderer.renderer.setAnimationLoop(() => this.frame());
  }

  /** Minutes de jeu absolues (pour les tickets et le SLA). */
  now(): number {
    return absMinutes(this.state.clock.day, this.state.clock.minutes);
  }

  // ================================================================ événements

  private bindEvents(): void {
    const controls = this.controller.controls;
    controls.addEventListener('lock', () => {
      this.lockPending = false;
      document.body.classList.add('locked');
      this.enterPlaying();
    });
    controls.addEventListener('unlock', () => {
      document.body.classList.remove('locked');
      this.controller.releaseKeys();
      if (this.expectingUnlock) {
        this.expectingUnlock = false;
        return;
      }
      if (this.mode === 'playing') this.pause();
    });
    document.addEventListener('pointerlockerror', () => this.onLockFailed());
    window.addEventListener('pointerdown', (e) => (this.lastPointerType = e.pointerType), { capture: true });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.controller.isLocked && this.mode === 'playing' && !this.map.isOpen) this.interact();
    });
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });
    const c = this.renderer.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => this.mode === 'rack' && this.rackCtl.onPointerDown(e));
    c.addEventListener('pointermove', (e) => this.mode === 'rack' && this.rackCtl.onPointerMove(e));
    c.addEventListener('pointerup', (e) => this.mode === 'rack' && this.rackCtl.onPointerUp(e));
    this.hud.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-act="exit-focus"]')) this.exitRack(false);
      else if (this.mode === 'rack') this.rackCtl.handleBarClick(t);
    });

    this.state.events.on('toast', (t) => {
      this.toasts.show(t.text, t.kind, t.title);
      if (t.kind === 'ticket') sound.play('ticket');
      else if (t.kind === 'warn' || t.kind === 'error') sound.play('notify');
    });
    this.state.events.on('statsChanged', () => this.hud.update(this.state));
    this.state.events.on('minute', (m) => {
      this.world.screens.tick(m);
      this.onMinute();
    });
    this.state.events.on('dayEnded', () => this.endDay());
  }

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (this.mode === 'app') {
        this.closingByKey = true;
        this.app.close();
      } else if (this.mode === 'dialog') this.closeDialog(true);
      else if (this.mode === 'rack') {
        if (!this.rackCtl.escape()) this.exitRack(true);
      } else if (this.mode === 'playing') this.pause();
      return;
    }
    if (e.repeat || this.mode !== 'playing') return;
    if (/^[1-9]$/.test(e.key)) {
      this.hotbar.select(Number(e.key) - 1);
      return;
    }
    if (key === 'p') {
      this.releasePointer();
      this.pause();
    } else if (key === 'e') this.interact();
    else if (key === 'm' || e.code === 'Semicolon') {
      this.map.toggle();
      sound.play('click');
    } else if (key === 'h') {
      this.settings.showHints = this.hud.toggleHints();
      saveSettings(this.settings);
    } else if (key === 'i') this.openStock(false);
  }

  private onWheel(e: WheelEvent): void {
    if (this.mode === 'rack') this.rackCtl.onWheel(e);
    else if (this.mode === 'playing' && Math.abs(e.deltaY) > 2) this.hotbar.select(this.hotbar.selected + Math.sign(e.deltaY));
  }

  // ================================================================ modes

  private enterPlaying(): void {
    this.mode = 'playing';
    this.menus.hideAll();
    this.hud.setVisible(true);
    this.hud.setCrosshairVisible(true);
    this.hotbar.setVisible(true);
    this.tutorial.setVisible(true);
  }

  private wantsLock(): boolean {
    const supported = typeof this.renderer.canvas.requestPointerLock === 'function' && !this.lockUnavailable;
    return supported && (!this.touchMode || this.lastPointerType === 'mouse');
  }

  private requestLock(): void {
    sound.unlock();
    this.controller.releaseKeys();
    if (!this.wantsLock()) {
      this.enterPlaying();
      return;
    }
    this.lockPending = true;
    try {
      const r = this.renderer.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => this.onLockFailed());
    } catch {
      this.onLockFailed();
    }
  }

  private onLockFailed(): void {
    if (!this.lockPending) return;
    this.lockPending = false;
    if (this.touchMode) {
      if (!this.lockUnavailable) {
        this.lockUnavailable = true;
        this.state.toast('Votre navigateur ne verrouille pas le pointeur : cliquez-glissez avec le trackpad pour regarder, ZQSD pour marcher, E pour interagir.', 'info', 'Clavier + trackpad');
      }
      this.enterPlaying();
      return;
    }
    this.mode = 'resume';
    this.menus.showResume();
  }

  private releasePointer(): void {
    if (this.controller.isLocked) {
      this.expectingUnlock = true;
      this.controller.controls.unlock();
    }
  }

  private start(kind: 'new' | 'continue' | 'sandbox'): void {
    sound.unlock();
    if (kind === 'continue') this.load(true);
    else this.newGame(kind === 'sandbox');
    this.requestLock();
  }

  private newGame(sandbox: boolean): void {
    this.state.clock.restore(1, DAY_START);
    this.state.xp = sandbox ? LEVELS[3].xp : 0;
    this.state.energy = 100;
    this.state.satisfaction = 80;
    this.state.sandbox = sandbox;
    this.state.day = GameState.emptyDay();
    this.net.load(createInitialNetwork());
    this.office.load(createInitialOffice());
    this.tickets.load({ tickets: [], nextId: 1001, nextSpawnAt: 0, history: [] });
    resetCliSessions();
    this.pendingCall = null;
    this.world.hideVisitor();
    this.visitor = null;
    this.lastEventDay = 0;
    this.powerCutAt = null;
    this.resetPlayer();
    this.world.doors.forEach((d) => {
      d.setOpen(sandbox);
      d.locked = !sandbox && !!d.def.locked;
    });
    this.refreshTicketStats();
    this.hud.update(this.state);
    if (sandbox) {
      this.tutorial.finish();
      this.world.setBossBubble(false);
      setTimeout(() => this.state.toast('Bac à sable : pas de chrono ni de tickets automatiques. Déclenchez les pannes de votre choix dans HelpDesk Pro → « Créer une panne ».', 'info', 'Bac à sable'), 500);
    } else this.startTutorial();
  }

  private pause(): void {
    this.mode = 'paused';
    this.map.close();
    this.hud.setVisible(false);
    this.hotbar.setVisible(false);
    this.tutorial.setVisible(false);
    this.menus.showPause();
  }

  private quitToTitle(): void {
    this.mode = 'title';
    this.menus.showStart();
  }

  private resetPlayer(): void {
    this.controller.setPose(SPOTS.spawn.x, SPOTS.spawn.z, SPOTS.spawn.yaw, -0.12);
  }

  private leaveFps(mode: Mode): void {
    this.mode = mode;
    this.interactions.clear();
    this.hud.setCrosshairVisible(false);
    this.hotbar.setVisible(false);
    this.map.close();
    this.releasePointer();
  }

  // ================================================================ interfaces

  private async openApp(view: FocusView | null, opts: AppOptions, build: () => HTMLElement): Promise<void> {
    if (this.mode !== 'playing') return;
    this.leaveFps('app');
    sound.play('open');
    if (view) await this.controller.focusOn(view.pos, view.look, 0.55);
    if ((this.mode as Mode) !== 'app') return;
    this.app.open(opts, build(), () => this.afterOverlayClosed());
  }

  private afterOverlayClosed(): void {
    sound.play('close');
    const byKey = this.closingByKey;
    this.closingByKey = false;
    this.controller.releaseKeys();
    void this.controller.restore();
    if (this.mode === 'dayend') return;
    if (byKey && this.wantsLock()) {
      this.mode = 'resume';
      this.menus.showResume();
    } else this.requestLock();
  }

  private helpdeskDeps(openTicket?: number) {
    return {
      tickets: this.tickets,
      office: this.office,
      net: this.net,
      state: this.state,
      now: () => this.now(),
      sandbox: this.state.sandbox,
      myHost: MY_DESK.pcName,
      onResolved: (t: Ticket, r: ResolveResult) => this.onResolved(t, r),
      onReload: (sw: string) => this.onSwitchReload(sw),
      createScenario: (id: string) => this.sandboxScenario(id),
      toast: (text: string, kind: 'ok' | 'warn' | 'error' | 'info' = 'info') => this.state.toast(text, kind),
      openTicket,
    };
  }

  private openHelpdesk(view: FocusView, openTicket?: number): void {
    this.tutorial.flags.add('helpdesk-open');
    void this.openApp(view, { title: 'HelpDesk Pro — Gestion des tickets', icon: '🎫', theme: 'theme-glpi' }, () => buildHelpdeskPro(this.helpdeskDeps(openTicket)));
  }

  private openStock(fromShelf: boolean): void {
    if (this.mode !== 'playing') return;
    void this.openApp(null, { title: fromShelf ? 'Étagère du helpdesk — stock de matériel' : 'Inventaire', icon: '📦', width: 'min(900px, 94vw)', height: 'min(620px, 88vh)' }, () =>
      buildStockWindow(this.office, (t, k) => this.state.toast(t, k ?? 'info')),
    );
  }

  private openSwitchConsole(sw: string): void {
    if (this.mode !== 'rack') return;
    this.rackCtl.exit();
    this.mode = 'app';
    sound.play('open');
    this.app.open(
      { title: `${sw} — Console (câble console RJ45/USB, 9600 bauds)`, icon: '💻', theme: 'theme-terminal', width: 'min(900px, 94vw)', height: 'min(600px, 86vh)' },
      buildSwitchConsole(this.net, sw, () => this.onSwitchReload(sw), 'console').root,
      () => {
        // Retour à la vue de la baie
        sound.play('close');
        this.closingByKey = false;
        this.mode = 'rack';
        this.rackCtl.enter();
      },
    );
  }

  /** « reload » : le switch redémarre pendant ~20 s ; la config non sauvegardée est perdue. */
  private onSwitchReload(sw: string): void {
    this.state.toast(`${sw} redémarre… (environ 20 secondes)`, 'warn', 'Switch');
    setTimeout(() => {
      this.net.finishReboot(sw);
      this.state.toast(`${sw} a redémarré.`, 'info', 'Switch');
    }, 20000);
  }

  private async openRack(rack: Rack3D): Promise<void> {
    if (this.mode !== 'playing') return;
    this.leaveFps('rack');
    const dist = this.touchMode && this.lastPointerType !== 'mouse' ? 0.36 : 0.46;
    const y = 1.72;
    const pos = rack.front.clone().addScaledVector(rack.frontNormal, dist).setY(y);
    const look = rack.front.clone().setY(y);
    sound.play('open');
    this.rackCtl.enter();
    await this.controller.focusOn(pos, look, 0.7);
  }

  private exitRack(byKey: boolean): void {
    if (this.mode !== 'rack') return;
    this.rackCtl.exit();
    sound.play('close');
    void this.controller.restore();
    if (byKey && this.wantsLock()) {
      this.mode = 'resume';
      this.menus.showResume();
    } else this.requestLock();
  }

  /** Ouvre une boîte de dialogue (PNJ, téléphone, arrière du PC…). */
  private openDialog(speaker: string, subtitle: string, text: string, choices: DialogChoice[], lookAt?: THREE.Object3D): void {
    if (this.mode === 'playing') {
      this.leaveFps('dialog');
      if (lookAt) {
        const box = new THREE.Box3().setFromObject(lookAt);
        const head = box.getCenter(new THREE.Vector3());
        head.y = box.max.y - 0.15;
        void this.controller.focusOn(this.renderer.camera.position.clone(), head, 0.35);
      }
    }
    this.dialog.show(speaker, subtitle, text, choices);
  }

  private closeDialog(byKey: boolean): void {
    if (this.mode !== 'dialog') return;
    this.dialog.hide();
    if (this.pendingCall && this.pendingCall.until === -1) this.answerCall();
    this.controller.releaseKeys();
    void this.controller.restore(0.3);
    if (byKey && this.wantsLock()) {
      this.mode = 'resume';
      this.menus.showResume();
    } else this.requestLock();
  }

  // ================================================================ interactions

  /** E / clic / bouton tactile : utilise l'objet tenu en main si possible, sinon l'action normale. */
  private interact(): void {
    if (this.mode !== 'playing' || this.map.isOpen) return;
    const target = this.interactions.hovered;
    if (!target) return;
    const item = this.hotbar.current;
    if (item && this.useItem(target.id, item)) return;
    target.onInteract();
  }

  /** Texte de la bulle quand on tient un objet. */
  private itemLabel(id: string, item: ItemId): string | null {
    const jack = this.jackOf(id);
    if (jack && item === 'tester') return `E — Tester le câble (prise ${jack})`;
    if (jack && item === 'rj45') return `E — Remplacer le câble par un neuf (prise ${jack})`;
    if (id === 'netprinter' && item === 'toner') return 'E — Remplacer le toner de IMP-COMPTA';
    if (id.startsWith('tower:') && item === 'ram') return 'E — Ouvrir le PC et ajouter la barrette de RAM';
    if (id.startsWith('tower:') && item === 'videocable') return 'E — Remplacer le câble HDMI';
    if (id.startsWith('pc:') && item === 'monitor') return 'E — Remplacer l’écran';
    if (id.startsWith('npc:') && item === 'laptop') return 'E — Remettre le portable de prêt';
    return null;
  }

  private jackOf(id: string): string | null {
    const m = /^(?:jack|cable):([A-Z]+-\d+)/.exec(id);
    return m ? m[1] : null;
  }

  private hostOfJack(jack: string): string {
    if (jack === 'HD-01') return MY_DESK.pcName;
    if (jack === 'P-01') return 'IMP-COMPTA';
    return DESKS.find((d) => d.id === jack)!.pcName;
  }

  private hostOfTower(id: string): string {
    return id === 'tower:HD-01' ? MY_DESK.pcName : DESKS.find((d) => `tower:${d.id}` === id)!.pcName;
  }

  private useItem(id: string, item: ItemId): boolean {
    const jack = this.jackOf(id);
    if (jack && item === 'tester') {
      this.testCable(jack);
      return true;
    }
    if (jack && item === 'rj45') {
      const host = this.hostOfJack(jack);
      const c = this.net.cableAt(`${host}:eth0`);
      if (c && c.b && !c.b.endsWith(':jack')) {
        this.state.toast('Le PC est branché sur autre chose que la prise : regardez de plus près.', 'warn');
        return true;
      }
      if (c) this.net.state.cables = this.net.state.cables.filter((x) => x !== c);
      this.net.connect(`${host}:eth0`, `${jack}:jack`, { kind: 'drop', color: 'bleu', length: 3 });
      this.office.consume('rj45');
      sound.play('plug');
      this.state.toast(`Câble remplacé par un neuf et branché dans la prise ${jack}.`, 'ok', 'Câblage');
      return true;
    }
    if (id === 'netprinter' && item === 'toner') {
      this.office.state.printers['IMP-COMPTA'].toner = 100;
      this.office.consume('toner');
      sound.play('click');
      this.state.toast('Toner neuf installé dans IMP-COMPTA (100 %).', 'ok', 'Imprimante');
      return true;
    }
    if (id.startsWith('tower:') && item === 'ram') {
      if (!this.office.hasItem('screwdriver')) {
        this.state.toast('Il vous faut le tournevis (étagère) pour ouvrir le boîtier.', 'warn');
        return true;
      }
      const host = this.hostOfTower(id);
      const pc = this.office.pc(host)!;
      if (pc.ramGb >= 16) {
        this.state.toast('Les deux emplacements mémoire sont déjà occupés (16 Go).', 'info');
        return true;
      }
      pc.ramGb += 8;
      this.office.consume('ram');
      this.office.reboot(host, Date.now());
      sound.play('click');
      this.state.toast(`Barrette de 8 Go ajoutée : ${pc.ramGb} Go au total. Le PC redémarre.`, 'ok', host);
      return true;
    }
    if (id.startsWith('tower:') && item === 'videocable') {
      const host = this.hostOfTower(id);
      this.office.pc(host)!.videoCable = true;
      this.office.consume('videocable');
      this.state.toast('Câble HDMI neuf branché.', 'ok', host);
      return true;
    }
    if (id.startsWith('pc:') && item === 'monitor') {
      const desk = DESKS.find((d) => `pc:${d.id}` === id);
      if (!desk) return false;
      const pc = this.office.pc(desk.pcName)!;
      if (!pc.monitorDead) {
        this.state.toast('Cet écran fonctionne : inutile de le remplacer.', 'info');
        return true;
      }
      pc.monitorDead = false;
      pc.monitorOn = true;
      this.office.consume('monitor');
      this.state.toast('Écran remplacé. L’ancien part au recyclage (DEEE).', 'ok', desk.pcName);
      return true;
    }
    if (id.startsWith('npc:') && item === 'laptop') {
      const login = id.slice(4);
      const loan = this.office.state.loans.find((l) => l.user === login && !l.delivered && !l.returned);
      if (!loan) {
        this.state.toast('Aucune fiche de prêt à son nom : remplissez-la d’abord dans HelpDesk Pro → Prêts.', 'warn');
        return true;
      }
      loan.delivered = true;
      const t = this.ticketOf(login);
      if (t) this.tickets.markContacted(t.id);
      this.office.consume('laptop');
      this.state.toast(`Portable ${loan.serial} remis à ${getUser(login)?.firstName}. Fiche de prêt signée.`, 'ok', 'Prêt');
      return true;
    }
    return false;
  }

  private testCable(jack: string): void {
    const host = this.hostOfJack(jack);
    const c = this.net.cableAt(`${host}:eth0`) ?? this.net.cableAt(`${jack}:jack`);
    sound.play('click');
    if (!c) {
      this.state.toast('Aucun câble à tester.', 'warn', 'Testeur');
      return;
    }
    const pairs = ['1-2', '3-6', '4-5', '7-8'];
    const result = pairs.map((p) => {
      const bad = (c.fault === 'open' && p === '3-6') || (c.fault === 'short' && p === '1-2') || (c.fault === 'crossed' && (p === '1-2' || p === '3-6'));
      return `${p} : ${bad ? (c.fault === 'open' ? '❌ coupure' : c.fault === 'short' ? '❌ court-circuit' : '❌ paires croisées') : '✅ OK'}`;
    });
    this.openDialog(
      'Testeur de câble RJ45',
      `câble de ${host}`,
      `${c.fault === 'none' ? 'Câble conforme (T568B).' : 'Câble DÉFECTUEUX : à remplacer.'}\n${result.join('   ·   ')}`,
      [{ text: 'OK', action: () => this.closeDialog(false) }],
    );
  }

  /** Libellés qui dépendent de l'état du jeu (appel en cours, écran éteint…). */
  private patchLabels(): void {
    const phone = this.interactions.get('phone');
    if (phone) phone.label = () => (this.pendingCall ? 'E — 📞 Décrocher (le téléphone sonne !)' : 'E — Téléphone');
    for (const d of DESKS) {
      const it = this.interactions.get(`pc:${d.id}`);
      if (!it) continue;
      it.label = () => {
        const h = this.net.host(d.pcName);
        const pc = this.office.pc(d.pcName);
        if (h && !h.powered) return `E — Allumer ${d.pcName}`;
        if (pc && !pc.monitorOn) return 'E — Appuyer sur le bouton de l’écran';
        return `E — Utiliser ${d.pcName}`;
      };
    }
    for (const u of USERS) {
      const it = this.interactions.get(`npc:${u.id}`);
      if (it) it.label = () => `E — Parler à ${u.firstName}${this.ticketOf(u.id) ? ' (ticket en cours)' : ''}`;
    }
  }

  private ticketOf(login: string): Ticket | undefined {
    return this.tickets.open.find((t) => t.requester === login);
  }

  // ================================================================ actions du monde

  private makeActions(): WorldActions {
    return {
      useMyPc: (view) => this.openHelpdesk(view),
      useUserPc: (desk, view) => this.useUserPc(desk, view),
      useTower: (_deskId, host) => this.useTower(host),
      toggleJack: (jackId, hostId) => this.toggleJack(jackId, hostId),
      openRack: (rack) => void this.openRack(rack),
      inspectUps: () => this.state.toast('Sur secteur · Batterie 100 % · Autonomie estimée 25 min · Charge 38 %', 'ok', 'Onduleur 3000VA'),
      talkTo: (user) => this.talkTo(user),
      talkToBoss: () => this.talkToBoss(),
      talkToVisitor: (user) => this.talkToVisitor(user),
      phone: () => this.usePhone(),
      shelf: () => this.openStock(true),
      coffee: () => this.coffee(),
      copier: () => this.state.toast('Prêt. Bac 1 : A4 (plein) · Bac 2 : A3 (bas) · Toner noir 64 %', 'info', 'Copieur COPIEUR-ET2'),
      printer: (name) => {
        if (name === 'MINI-SWITCH') {
          this.state.toast('Un petit switch 5 ports « non administrable » branché sur DEUX prises murales (B-07 et B-08) : c’est une boucle réseau !', 'warn', 'Switch perso');
          return;
        }
        const p = this.office.state.printers[name === 'IMP-COMPTA' ? 'IMP-COMPTA' : 'HP-DIR'];
        if (!p) return;
        const st = p.toner <= 3 ? '⚠️ Remplacer la cartouche de toner' : p.paperJam ? '⚠️ Bourrage papier' : 'Prête';
        this.state.toast(`${st} · Toner ${p.toner} % · ${p.queue.length} document(s) en file${p.host ? ' · IP 192.168.30.10' : ' · USB'}`, p.toner <= 3 ? 'warn' : 'info', p.name);
      },
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
    const host = this.net.host(desk.pcName);
    const pc = this.office.pc(desk.pcName)!;
    if (host && !host.powered) {
      host.powered = true;
      this.net.changed();
      sound.play('click');
      this.state.toast(`${desk.pcName} démarre… Écran de connexion Windows.`, 'info', desk.pcName);
      return;
    }
    if (!pc.monitorOn) {
      pc.monitorOn = true;
      this.office.changed();
      sound.play('click');
      this.state.toast('Vous appuyez sur le bouton de l’écran… il s’allume ! (Il était simplement éteint.)', 'ok', desk.pcName);
      return;
    }
    if (pc.monitorDead) {
      this.state.toast('L’écran ne s’allume pas du tout, même avec le bouton : il est HS. Prenez un écran de remplacement dans le stock.', 'warn', desk.pcName);
      return;
    }
    if (!pc.videoCable) {
      this.state.toast('L’écran affiche « Aucun signal ». Regardez l’arrière de l’unité centrale.', 'warn', desk.pcName);
      return;
    }
    void this.openApp(view, { title: `${desk.pcName} — Windows 10 Professionnel`, icon: '🪟', theme: 'theme-windows' }, () =>
      buildUserDesktop({
        office: this.office,
        net: this.net,
        desk,
        minutes: () => this.state.clock.minutes,
        toast: (t, k) => this.state.toast(t, k ?? 'info'),
        onReboot: () => sound.play('click'),
      }),
    );
  }

  /** Arrière de l'unité centrale : câbles et boîtier. */
  private useTower(host: string): void {
    const pc = this.office.pc(host);
    if (!pc) return;
    const h = this.net.host(host)!;
    const choices: DialogChoice[] = [
      {
        text: pc.videoCable ? 'Vérifier le câble vidéo (HDMI) — il est branché' : '🔌 Rebrancher le câble vidéo (HDMI)',
        action: () => {
          if (!pc.videoCable) {
            pc.videoCable = true;
            this.office.changed();
            sound.play('plug');
            this.state.toast('Câble HDMI rebranché : l’image revient.', 'ok', host);
          } else this.state.toast('Le câble HDMI est bien branché des deux côtés.', 'info', host);
          this.closeDialog(false);
        },
      },
      {
        text: h.powered ? '🔄 Appui long sur le bouton : redémarrer le PC' : '⏻ Allumer le PC',
        action: () => {
          if (!h.powered) {
            h.powered = true;
            this.net.changed();
          } else this.office.reboot(host, Date.now());
          sound.play('click');
          this.closeDialog(false);
        },
      },
      {
        text: '🪛 Ouvrir le boîtier',
        action: () => {
          if (!this.office.hasItem('screwdriver')) this.state.toast('Il vous faut le tournevis (étagère du helpdesk).', 'warn');
          else this.state.toast(`Carte mère : ${pc.ramGb} Go de RAM installés (${pc.ramGb >= 16 ? 'aucun emplacement libre' : '1 emplacement libre'}). Tenez une barrette de RAM en main pour l’ajouter.`, 'info', host);
          this.closeDialog(false);
        },
      },
      { text: 'Fermer', action: () => this.closeDialog(false) },
    ];
    this.openDialog(
      `Arrière de ${host}`,
      'unité centrale',
      `Alimentation : ${pc.powerCable ? 'branchée' : 'DÉBRANCHÉE'} · Réseau : ${this.net.link(`${host}:eth0`).up ? 'LED verte' : 'LED éteinte'} · Vidéo : ${pc.videoCable ? 'HDMI branché' : 'HDMI DÉBRANCHÉ'}`,
      choices,
    );
  }

  private toggleJack(jackId: string, hostId: string): void {
    // Un câble « étranger » (mini-switch) branché dans la prise ?
    const atJack = this.net.cableAt(`${jackId}:jack`);
    if (atJack && atJack.a.startsWith('SW-PERSO')) {
      this.net.disconnect(atJack.id);
      sound.play('plug');
      this.state.toast(`Câble du mini-switch retiré de la prise ${jackId}. La boucle est cassée.`, 'ok', `Prise ${jackId}`);
      return;
    }
    const cable = this.net.cableAt(`${hostId}:eth0`);
    if (!cable) {
      this.state.toast(`Pas de câble entre ${hostId} et la prise ${jackId}.`, 'warn', `Prise ${jackId}`);
      return;
    }
    if (cable.b && cable.b !== `${jackId}:jack`) {
      this.state.toast(`Le câble de ${hostId} est branché sur ${cable.b.split(':')[0]}, pas sur la prise.`, 'info', `Prise ${jackId}`);
      return;
    }
    sound.play('plug');
    if (cable.b) {
      this.net.unplug(cable.id);
      this.state.toast(`Câble de ${hostId} débranché de la prise ${jackId}.`, 'info', `Prise ${jackId}`);
    } else {
      this.net.plug(cable.id, `${jackId}:jack`);
      const l = this.net.link(`${hostId}:eth0`);
      const msg = l.up
        ? `Câble branché : lien établi avec ${l.peer?.replace(':', ' ')}.`
        : l.reason === 'nocable' || l.reason === 'unwired'
          ? 'Câble branché, mais la prise n’est pas brassée dans la baie : pas de lien.'
          : l.reason === 'fault'
            ? 'Câble branché, mais toujours pas de lien… Le câble est peut-être défectueux (testeur ?).'
            : 'Câble branché, mais pas de lien (port désactivé sur le switch ?).';
      this.state.toast(msg, l.up ? 'ok' : 'warn', `Prise ${jackId}`);
    }
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

  // ================================================================ PNJ

  private talkTo(user: UserDef): void {
    if (this.mode !== 'playing') return;
    this.tutorial.flags.add(`talk:${user.id}`);
    const npc = this.interactions.get(`npc:${user.id}`)?.object;
    const t = this.ticketOf(user.id);
    const name = `${user.firstName} ${user.lastName}`;
    const subtitle = `${user.service} · bureau ${user.desk}`;
    const bye = { text: 'À plus tard !', action: () => this.closeDialog(false) };
    if (!t) {
      const loan = this.office.state.loans.find((l) => l.user === user.id && !l.delivered && !l.returned);
      const greetings = GREETINGS[user.personality];
      const choices: DialogChoice[] = [
        {
          text: 'Tout fonctionne bien sur votre poste ?',
          action: () => this.dialog.show(name, subtitle, user.itLevel <= 2 ? 'Euh… je crois ? L’internet marche, en tout cas. Enfin, le Google.' : 'Oui, rien à signaler. Je ferai un ticket s’il y a un souci, promis.', [bye]),
        },
        bye,
      ];
      const hello = loan ? 'Ah, c’est pour mon portable de prêt ? (Tenez-le en main et appuyez sur E devant moi.)' : greetings[Math.floor(Math.random() * greetings.length)];
      this.openDialog(name, subtitle, hello, choices, npc);
      return;
    }
    this.tickets.markContacted(t.id);
    const sc = getScenario(t.scenario);
    const pickLine = (lines: string[] | undefined) => (lines?.length ? lines[Math.floor(Math.random() * lines.length)] : 'Je ne sais pas trop…');
    const sub = `${subtitle} · ticket #${t.id}`;
    const menu = (text: string): void =>
      this.dialog.show(name, sub, text, [
        { text: 'Pouvez-vous me décrire le problème ?', action: () => menu(pickLine(sc?.dialog.describe)) },
        { text: 'Qu’avez-vous fait juste avant que ça arrive ?', action: () => menu(pickLine(sc?.dialog.before)) },
        {
          text: 'C’est réparé, vous pouvez vérifier ?',
          action: () => {
            if (this.tickets.isResolved(t)) {
              this.tickets.addFollowup(t.id, name, 'Je confirme, ça remarche. Merci beaucoup !', 'user', this.now());
              menu(user.personality === 'raleur' ? 'Ah… oui, ça marche. Bon. Merci quand même. Pensez à résoudre votre ticket.' : 'Oui ! Ça remarche, merci beaucoup ! Vous pouvez résoudre le ticket.');
            } else menu(user.personality === 'raleur' ? 'Non, toujours pas ! Vous êtes sûr de vous ?' : 'Hmm… non, ça ne marche toujours pas, désolé.');
          },
        },
        { text: 'Je m’en occupe, je reviens vers vous.', action: () => this.closeDialog(false) },
      ]);
    this.openDialog(name, sub, '', [], npc);
    menu(`Ah, merci d’être passé pour mon ticket « ${t.title} » !`);
  }

  private talkToBoss(): void {
    if (this.mode !== 'playing') return;
    this.world.setBossBubble(false);
    const lvl = this.state.levelIndex;
    const next = LEVELS[lvl + 1];
    const intro = this.tutorial.active
      ? 'Suis les étapes du tutoriel affichées en haut à gauche, je te regarde faire !'
      : `Alors, ça avance ? Tu es ${this.state.levelName}${next ? ` : encore ${next.xp - this.state.xp} XP pour passer ${next.name}.` : ' : le plus haut grade !'}`;
    const end = { text: 'OK, merci', action: () => this.closeDialog(false) };
    this.openDialog(
      'Bernard Durand',
      'Responsable du service informatique',
      intro,
      [
        { text: 'Tu as un conseil ?', action: () => this.dialog.show('Bernard Durand', 'Responsable informatique', BOSS_TIPS[Math.floor(Math.random() * BOSS_TIPS.length)], [end]) },
        {
          text: 'Où en sont les tickets ?',
          action: () => {
            const open = this.tickets.open;
            const late = open.filter((t) => this.tickets.slaRemaining(t, this.now()) < 0).length;
            this.dialog.show('Bernard Durand', 'Responsable informatique', open.length ? `${open.length} ticket(s) ouvert(s)${late ? `, dont ${late} hors délai : dépêche-toi !` : '. Tout est dans les délais.'}` : 'Aucun ticket ouvert, bravo. Profites-en pour faire le tour de l’étage.', [end]);
          },
        },
        { text: 'À plus tard', action: () => this.closeDialog(false) },
      ],
      this.interactions.get('boss')?.object,
    );
  }

  private talkToVisitor(user: UserDef): void {
    if (this.mode !== 'playing' || !this.visitor) return;
    const t = this.tickets.get(this.visitor.ticket);
    const sc = t ? getScenario(t.scenario) : undefined;
    const name = `${user.firstName} ${user.lastName}`;
    if (t) {
      this.tickets.markContacted(t.id);
      if (t.status === 'new') this.tickets.take(t.id, this.now());
    }
    const done = () => {
      this.world.hideVisitor();
      this.visitor = null;
      this.closeDialog(false);
    };
    const sub = `vient vous voir · ticket #${t?.id ?? ''}`;
    const menu = (text: string): void =>
      this.dialog.show(name, sub, text, [
        { text: 'Qu’avez-vous fait juste avant ?', action: () => menu(sc?.dialog.before[0] ?? '…') },
        { text: 'Je note tout dans le ticket, retournez à votre poste, j’arrive.', action: done },
      ]);
    this.openDialog(name, sub, '', [], this.interactions.get(`visitor:${user.id}`)?.object);
    menu(`Bonjour ! Je préférais venir directement… ${t?.description ?? ''}`);
  }

  // ================================================================ téléphone

  private usePhone(): void {
    if (!this.pendingCall) {
      sound.play('click');
      this.state.toast('Tonalité… Aucun appel en attente.', 'info', 'Téléphone — poste 2222');
      return;
    }
    const call = this.pendingCall;
    call.until = -1; // décroché
    const u = getUser(call.target.user);
    const name = `📞 ${u ? `${u.firstName} ${u.lastName}` : call.target.user}`;
    const desc = call.sc.descriptions[0].replace(/\{prenom\}/g, u?.firstName ?? '').replace(/\{bureau\}/g, call.target.desk).replace(/\{pc\}/g, call.target.host);
    const sub = `${u?.service ?? ''} · au téléphone`;
    const menu = (text: string): void =>
      this.dialog.show(name, sub, text, [
        { text: 'Pouvez-vous me décrire le problème ?', action: () => menu(call.sc.dialog.describe[0]) },
        { text: 'Qu’avez-vous fait juste avant ?', action: () => menu(call.sc.dialog.before[0]) },
        { text: 'Je crée le ticket et je m’en occupe tout de suite.', action: () => this.closeDialog(false) },
      ]);
    sound.play('click');
    this.openDialog(name, sub, '', []);
    menu(`Allô, le support ? C’est ${u?.firstName ?? ''}, ${u?.service ?? ''}. ${desc}`);
  }

  /** Fin d'un appel décroché : création du ticket (utilisateur déjà contacté). */
  private answerCall(): void {
    const call = this.pendingCall;
    if (!call) return;
    this.pendingCall = null;
    const created = this.tickets.create(call.sc, call.target, this.now(), 'phone');
    for (const tk of created) {
      this.tickets.markContacted(tk.id);
      this.tickets.take(tk.id, this.now());
    }
    this.state.toast(`Ticket #${created[0].id} créé suite à l’appel de ${getUser(created[0].requester)?.firstName}.`, 'info', 'HelpDesk Pro');
  }

  // ================================================================ arrivée des tickets

  /** Crée un ticket (et la panne) selon son canal d'arrivée. */
  private spawn(sc: ScenarioDef, target: ScenarioTarget, channel?: Channel): void {
    const ch: Channel = channel ?? sc.channel ?? (Math.random() < 0.6 ? 'glpi' : Math.random() < 0.55 ? 'phone' : 'visit');
    if (ch === 'phone' && !this.pendingCall) {
      this.pendingCall = { sc, target, until: Date.now() + 28000, lastRing: 0 };
      this.state.toast('📞 Le téléphone sonne sur votre bureau (poste 2222) !', 'warn', 'Appel entrant');
      return;
    }
    if (ch === 'visit' && !this.visitor) {
      const [t] = this.tickets.create(sc, target, this.now(), 'visit');
      const u = getUser(t.requester);
      if (u) {
        this.world.showVisitor(u);
        this.visitor = { ticket: t.id, user: u.id, until: this.now() + 40 };
        this.state.toast(`${u.firstName} ${u.lastName} vient vous voir au helpdesk.`, 'ticket', `Ticket #${t.id} — ${t.desk}`);
      }
      return;
    }
    this.tickets.create(sc, target, this.now(), 'glpi');
  }

  private spawnRandom(): void {
    const pick = this.tickets.pickScenario(this.state.levelIndex);
    if (pick) this.spawn(pick.sc, pick.target);
  }

  private sandboxScenario(id: string): void {
    const sc = getScenario(id);
    if (!sc) return;
    const targets = this.tickets.targetsFor(sc);
    if (!targets.length) {
      this.state.toast('Aucun utilisateur disponible pour cette panne (déjà un ticket en cours ?).', 'warn');
      return;
    }
    this.tickets.create(sc, targets[Math.floor(Math.random() * targets.length)], this.now(), 'glpi');
  }

  private onTicketEvent(type: 'created' | 'updated' | 'reopened' | 'solved' | 'closed', t: Ticket): void {
    this.refreshTicketStats();
    if (type === 'created') {
      this.state.day.ticketsReceived = (this.state.day.ticketsReceived ?? 0) + 1;
      if (t.channel === 'glpi') this.state.toast(t.title, 'ticket', `Nouveau ticket #${t.id} — ${t.desk} (${t.category})`);
    } else if (type === 'reopened') {
      this.state.day.reopened = (this.state.day.reopened ?? 0) + 1;
      this.state.satisfaction = Math.max(0, this.state.satisfaction - 4);
      sound.play('denied');
      this.state.toast(`#${t.id} : l’utilisateur a rouvert le ticket, le problème est toujours là !`, 'error', 'Ticket rouvert');
    }
  }

  private onResolved(t: Ticket, r: ResolveResult): void {
    if (!r.ok) return;
    this.state.addXp(r.xp);
    this.state.day.ticketsResolved++;
    if (t.slaMissed) this.state.day.slaMissed++;
    else this.state.day.slaOk++;
    this.state.satisfaction = this.tickets.averageSatisfaction(80);
    sound.play('notify');
    this.state.toast(`${r.message} +${r.xp} XP · satisfaction ${r.satisfaction} %`, t.slaMissed ? 'warn' : 'ok', `Ticket #${t.id} résolu`);
    this.refreshTicketStats();
  }

  private refreshTicketStats(): void {
    const open = this.tickets.open;
    this.state.openTicketCount = open.length;
    this.state.openTicketDesks = new Set(open.map((t) => t.desk));
    this.hud.update(this.state);
  }

  /** Appelé à chaque minute de jeu. */
  private onMinute(): void {
    const now = this.now();
    const m = this.state.clock.minutes;
    this.tickets.tick(now);
    this.office.restock(this.state.clock.day);
    if (this.state.sandbox || this.tutorial.active) return;
    // Visiteur reparti sans être reçu
    if (this.visitor && now > this.visitor.until) {
      const u = getUser(this.visitor.user);
      this.world.hideVisitor();
      this.visitor = null;
      this.state.toast(`${u?.firstName} est reparti(e) sans avoir pu vous parler. Le ticket reste ouvert.`, 'warn', 'Visite');
    }
    // Évènement aléatoire : coupure de courant (au plus une fois par jour)
    if (this.lastEventDay !== this.state.clock.day && m > 600 && m < 960) {
      if (this.powerCutAt === null) this.powerCutAt = 600 + Math.floor(Math.random() * 360);
      if (m >= this.powerCutAt) {
        this.lastEventDay = this.state.clock.day;
        this.powerCutAt = null;
        if (Math.random() < 0.35 || (this.state.levelIndex >= 2 && !this.tickets.state.tickets.some((x) => x.scenario === 'config-perdue'))) this.powerCut();
      }
    }
    // Nouveau ticket
    const maxOpen = 3 + this.state.levelIndex;
    if (m >= 525 && m < 1010 && now >= this.tickets.state.nextSpawnAt && this.tickets.open.length < maxOpen && !this.pendingCall) {
      this.spawnRandom();
      const gap = [
        [40, 65],
        [32, 55],
        [26, 46],
        [22, 40],
      ][Math.min(3, this.state.levelIndex)];
      this.tickets.state.nextSpawnAt = now + gap[0] + Math.random() * (gap[1] - gap[0]);
    }
  }

  /** Coupure de courant : l'onduleur tient, mais SW-01 redémarre (et perd sa config non sauvegardée). */
  private powerCut(): void {
    sound.play('denied');
    this.state.toast('Coupure de courant ! L’onduleur a pris le relais… mais certains équipements ont redémarré.', 'warn', '⚡ Panne électrique');
    const hemi = this.renderer.scene.children.find((c) => (c as THREE.HemisphereLight).isHemisphereLight) as THREE.HemisphereLight | undefined;
    if (hemi) {
      const base = hemi.intensity;
      let n = 0;
      const flick = setInterval(() => {
        hemi.intensity = n % 2 ? base : base * 0.15;
        if (++n > 7) {
          clearInterval(flick);
          hemi.intensity = base;
        }
      }, 180);
    }
    const sc = getScenario('config-perdue');
    if (sc && this.state.levelIndex >= 2 && !this.tickets.state.tickets.some((x) => x.scenario === sc.id)) {
      const targets = this.tickets.targetsFor(sc);
      if (targets.length) setTimeout(() => this.tickets.create(sc, targets[0], this.now(), 'glpi'), 4000);
    }
  }

  // ================================================================ tutoriel

  private startTutorial(existingTicket?: number, index = 0): void {
    let id = existingTicket;
    if (id === undefined) {
      const sc = SCENARIOS.find((s) => s.id === 'cable-debranche')!;
      const d = DESKS.find((x) => x.userId === 'jmartin')!;
      const [t] = this.tickets.create(sc, { user: 'jmartin', host: d.pcName, desk: d.id, data: {} }, this.now(), 'glpi');
      t.title = 'Internet marche plus';
      id = t.id;
    }
    this.tutorialTicket = id;
    this.world.setBossBubble(true);
    const tk = () => this.tickets.get(id!)!;
    if (index === 0) this.tutorial.flags.clear();
    this.tutorial.start(
      [
        { text: 'Bienvenue ! Je suis Bernard, ton responsable. Ton poste est juste devant toi : approche-toi et ouvre HelpDesk Pro.', hint: 'Vise l’écran et appuie sur E (ou le bouton bleu).', done: () => this.tutorial.flags.has('helpdesk-open') },
        { text: `Un premier ticket vient d’arriver (#${id}, Julie Martin). Ouvre-le et clique sur « Prendre en charge ».`, done: () => tk().status !== 'new' },
        { text: 'Rassure l’utilisatrice : « Répondre / ajouter un suivi » et préviens Julie que tu passes la voir.', hint: 'Choisis un message prédéfini puis « Envoyer le suivi ».', done: () => tk().contacted },
        { text: 'Ferme HelpDesk Pro (✕ ou Échap) et va voir Julie dans l’open space Compta, bureau B-01. Parle-lui.', hint: 'M affiche le plan. B-01 est tout à gauche de l’open space Compta, contre la fenêtre.', done: () => this.tutorial.flags.has('talk:jmartin') },
        { text: 'Regarde sous son bureau : accroupis-toi (C) à côté de la chaise et rebranche le câble dans la prise murale B-01.', hint: 'Baisse-toi et vise la prise blanche au mur, sous le plateau (E).', done: () => this.tickets.isResolved(tk()) },
        { text: 'Le réseau est revenu ! Retourne à ton PC et résous le ticket en décrivant la solution.', hint: 'Bouton « Résoudre », solution type « Câble réseau rebranché / remplacé. »', done: () => tk().status === 'solved' || tk().status === 'closed' },
      ],
      index,
    );
  }

  private onTutorialDone(): void {
    this.world.setBossBubble(false);
    this.tickets.state.nextSpawnAt = this.now() + 8;
    if (!this.state.sandbox && this.mode !== 'title') {
      this.state.toast('Bravo, premier ticket bouclé ! Les vraies demandes arrivent maintenant. La baie est en salle serveur (badge), le stock sur l’étagère (I). Bon courage !', 'ok', 'Bernard (chef de service)');
    }
  }

  // ================================================================ journées / sauvegarde

  private endDay(): void {
    if (this.state.sandbox) return;
    this.mode = 'dayend';
    if (this.app.isOpen) this.app.close();
    if (this.dialog.isOpen) this.dialog.hide();
    this.rackCtl.exit();
    void this.controller.restore(0.01);
    this.releasePointer();
    this.map.close();
    this.hud.setVisible(false);
    this.hotbar.setVisible(false);
    this.tutorial.setVisible(false);
    this.pendingCall = null;
    this.world.hideVisitor();
    this.visitor = null;
    const d = this.state.day;
    const open = this.tickets.open.length;
    const slaRate = d.ticketsResolved ? d.slaOk / d.ticketsResolved : 1;
    this.save(true);
    let remark: string;
    if (!d.ticketsResolved) remark = 'Journée calme… ou alors tu n’as pas ouvert HelpDesk Pro ? Demain, on veut des tickets résolus.';
    else if (slaRate >= 0.9 && this.state.satisfaction >= 75) remark = 'Excellent travail ! Les utilisateurs sont ravis et les délais sont tenus. Continue comme ça.';
    else if (slaRate < 0.5) remark = 'Trop de SLA dépassés aujourd’hui. Priorise les tickets urgents et préviens les utilisateurs.';
    else if ((d.reopened ?? 0) > 1) remark = 'Attention aux tickets rouverts : vérifie que le problème est vraiment réglé avant de cliquer sur « Résoudre ».';
    else remark = 'Bonne journée dans l’ensemble. Pense à communiquer davantage avec les utilisateurs.';
    if (d.coffees > 3) remark += ' Et doucement sur le café !';
    this.menus.showDayEnd(
      [
        { label: 'Tickets reçus', value: String(d.ticketsReceived ?? 0) },
        { label: 'Tickets résolus', value: String(d.ticketsResolved) },
        { label: 'SLA respectés / dépassés', value: `${d.slaOk} / ${d.slaMissed}` },
        { label: 'Tickets rouverts', value: String(d.reopened ?? 0) },
        { label: 'Encore ouverts (reportés à demain)', value: String(open) },
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
    this.tickets.state.nextSpawnAt = this.now() + 15;
    if (this.office.restock(this.state.clock.day)) this.state.toast('Réassort : le stock de matériel a été réapprovisionné.', 'info', 'Stock');
    this.resetPlayer();
    this.hud.update(this.state);
    this.requestLock();
  }

  private save(silent = false): void {
    const ok = writeSave(
      this.state,
      { x: this.controller.x, z: this.controller.z, yaw: this.controller.yaw, pitch: this.controller.pitch },
      this.world.doors.filter((d) => d.isOpen).map((d) => d.def.id),
      this.net.state,
      {
        office: this.office.state,
        tickets: this.tickets.state,
        tutorial: { active: this.tutorial.active, index: this.tutorial.index },
        sandbox: this.state.sandbox,
        lastEventDay: this.lastEventDay,
      },
    );
    if (!silent) this.state.toast(ok ? 'Partie sauvegardée.' : 'Impossible de sauvegarder (stockage indisponible).', ok ? 'ok' : 'error', 'Sauvegarde');
    this.menus.refreshContinue();
  }

  private load(silent = false): void {
    const data = readSave();
    if (!data) {
      if (!silent) this.state.toast('Aucune sauvegarde trouvée.', 'warn', 'Chargement');
      else this.newGame(false);
      return;
    }
    applySave(this.state, data);
    this.state.sandbox = !!data.sandbox;
    this.net.load(data.network ?? createInitialNetwork());
    this.office.load(data.office ?? createInitialOffice());
    this.tickets.load(data.tickets ?? { tickets: [], nextId: 1001, nextSpawnAt: 0, history: [] });
    this.lastEventDay = data.lastEventDay ?? 0;
    resetCliSessions();
    for (const sw of Object.values(this.net.state.switches)) if (sw.rebooting) this.net.finishReboot(sw.id);
    this.pendingCall = null;
    this.world.hideVisitor();
    this.visitor = null;
    this.controller.setPose(data.player.x, data.player.z, data.player.yaw, data.player.pitch);
    for (const d of this.world.doors) {
      const open = data.openDoors.includes(d.def.id);
      d.setOpen(open);
      if (open) d.locked = false;
    }
    this.tutorial.finish();
    if (data.tutorial?.active && !this.state.sandbox) {
      const t = this.tickets.state.tickets.find((x) => x.scenario === 'cable-debranche');
      if (t) this.startTutorial(t.id, data.tutorial.index);
    }
    this.world.syncNetwork();
    this.world.screens.tick(this.state.clock.minutes);
    this.refreshTicketStats();
    this.hotbar.render(this.office.state.inventory);
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

  // ================================================================ boucle

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += dt;
    const live = this.mode === 'playing' || this.mode === 'app' || this.mode === 'dialog' || this.mode === 'rack';
    if (live) this.state.update(dt);
    this.office.tick(Date.now());

    // Téléphone qui sonne
    if (this.pendingCall && this.pendingCall.until > 0 && live) {
      const t = Date.now();
      if (t - this.pendingCall.lastRing > 2600) {
        this.pendingCall.lastRing = t;
        sound.play('ring');
      }
      if (t > this.pendingCall.until) {
        const call = this.pendingCall;
        this.pendingCall = null;
        const [tk] = this.tickets.create(call.sc, call.target, this.now(), 'glpi');
        tk.description = `(Message laissé sur le répondeur) ${tk.description}`;
        this.state.toast(`Appel manqué de ${getUser(tk.requester)?.firstName} : un ticket a été créé (#${tk.id}).`, 'warn', 'Appel manqué');
      }
    }

    this.controller.updateTween(dt);
    let moving = false;
    if (this.mode === 'playing' && !this.controller.focused) {
      this.controller.speedMultiplier = this.state.energy < 15 ? 0.7 : 1;
      const bx = this.controller.x;
      const bz = this.controller.z;
      this.controller.update(dt, this.world.colliders);
      moving = Math.hypot(this.controller.x - bx, this.controller.z - bz) > 0.001;
    }
    this.world.update(dt);
    this.held.update(dt, moving, this.mode === 'playing');
    this.tutorial.update();

    const canInteract = this.mode === 'playing' && !this.map.isOpen && !this.controller.focused;
    const hovered = this.interactions.update(this.renderer.camera, canInteract);
    let prompt = canInteract ? (hovered?.label() ?? null) : null;
    const item = this.hotbar.current;
    if (canInteract && hovered && item) prompt = this.itemLabel(hovered.id, item) ?? prompt;
    if (prompt !== this.lastPrompt) {
      this.hud.setPrompt(prompt);
      this.lastPrompt = prompt;
    }
    this.hud.setCrouching(this.mode === 'playing' && this.controller.crouching);
    if (this.touch) {
      this.touch.setVisible(this.mode === 'playing' && !this.controller.isLocked);
      this.touch.setAction(prompt);
      this.touch.setCrouching(this.controller.crouching);
    }
    this.map.draw(this.controller.x, this.controller.z, this.controller.yaw, this.state.openTicketDesks, this.elapsed);

    this.renderer.render();

    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      const info = this.renderer.renderer.info.render;
      this.fps.textContent = `${Math.round(this.frames / this.fpsTimer)} FPS · ${info.calls} draw calls`;
      this.frames = 0;
      this.fpsTimer = 0;
    }
  }

  /** Outils de test de bout en bout (console du navigateur : window.game.debug). */
  readonly debug = {
    spawn: (id: string) => this.sandboxScenario(id),
    give: (id: ItemId) => this.office.takeItem(id),
    tutorialTicket: () => this.tutorialTicket,
  };
}
