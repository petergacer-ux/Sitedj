/**
 * Assemble l'étage complet et enregistre les objets interactifs.
 * Les actions (ouvrir GLPI, parler à un PNJ…) sont déléguées au Game via WorldActions.
 */
import * as THREE from 'three';
import { DESKS, DOORS, MY_DESK, SPOTS, type DeskDef } from '../data/map';
import { USERS, getUser, type UserDef } from '../data/users';
import type { InteractionSystem } from '../engine/InteractionSystem';
import type { AABB2 } from './collision';
import { Door } from './Door';
import { addSign, buildFloor } from './FloorBuilder';
import {
  addCollider,
  buildCoffeeCorner,
  buildCopier,
  buildDesk,
  buildMeetingRoom,
  buildNetworkPrinter,
  buildPhone,
  buildPlant,
  buildShelf,
  buildSmallPrinter,
  type BuildCtx,
  type DeskBuild,
} from './furniture';
import type { Network } from '../network/Network';
import { Rack3D } from './Rack3D';
import { makeLabel } from './labels';
import { C, mat } from './materials';
import { ModelLoader } from './ModelLoader';
import { animateNpc, buildSeatedNpc, buildStandingNpc, type NpcBuild } from './npc';
import type { Office } from '../sim/Office';
import { ScreenManager } from './ScreenManager';
import { StaticBatcher } from './StaticBatcher';

export interface FocusView {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export interface WorldActions {
  useMyPc(view: FocusView): void;
  useUserPc(desk: DeskDef, view: FocusView): void;
  /** Arrière de l'unité centrale (câbles, ouverture du boîtier). */
  useTower(deskId: string, host: string): void;
  talkToBoss(): void;
  talkToVisitor(user: UserDef): void;
  /** Prise murale : brancher / débrancher le câble (jackId = B-01, HD-01, P-01). */
  toggleJack(jackId: string, hostId: string): void;
  openRack(rack: Rack3D): void;
  inspectUps(): void;
  talkTo(user: UserDef): void;
  phone(): void;
  shelf(): void;
  coffee(): void;
  copier(): void;
  printer(name: string): void;
  door(door: Door): void;
  tv(): void;
}

export class World {
  readonly root = new THREE.Group();
  readonly colliders: AABB2[] = [];
  readonly screens = new ScreenManager();
  readonly doors: Door[] = [];
  readonly desks = new Map<string, DeskBuild>();
  readonly models = new ModelLoader();
  readonly occluders: THREE.Object3D[] = [];
  rack!: Rack3D;
  /** Câbles de poste visibles : prise → [branché, débranché]. */
  private jackCables = new Map<string, { host: string; plugged: THREE.Mesh; loose: THREE.Mesh }>();
  private npcs: NpcBuild[] = [];
  /** PNJ assis par login (pour les cacher quand ils se lèvent). */
  private seated = new Map<string, NpcBuild>();
  private visitor: { user: string; npc: NpcBuild } | null = null;
  private boss!: NpcBuild;
  private miniSwitch!: THREE.Group;
  private time = 0;

  constructor(
    private interactions: InteractionSystem,
    private actions: WorldActions,
    private net: Network,
    private office: Office,
  ) {
    this.root.name = 'world';
  }

  build(): void {
    const props = new StaticBatcher();
    const solid = new StaticBatcher();
    const ctx: BuildCtx = { scene: this.root, props, solid, colliders: this.colliders, screens: this.screens };
    const I = this.interactions;
    const A = this.actions;

    buildFloor(ctx);

    // --- Portes ---
    for (const def of DOORS) {
      const door = new Door(def);
      this.root.add(door.pivot);
      this.colliders.push(door.collider);
      this.doors.push(door);
      this.occluders.push(door.panel);
      addSign(ctx, def.sign, def.x, def.z, def.signSide);
      I.register({
        id: def.id,
        object: door.panel,
        label: () => (door.isOpen ? 'E — Fermer la porte' : door.locked ? 'E — Badger (porte verrouillée)' : 'E — Ouvrir la porte'),
        onInteract: () => A.door(door),
      });
      if (def.locked) {
        // Lecteur de badge côté couloir
        const reader = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.03), mat(0x222222));
        reader.position.set(def.x + def.width / 2 + 0.2, 1.2, def.z + def.signSide * 0.09);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
        led.position.set(0, 0.04, def.signSide * 0.016);
        led.name = 'badge-led';
        reader.add(led);
        this.root.add(reader);
        door.pivot.userData.badgeLed = led;
      }
    }

    // --- Mon poste helpdesk ---
    const mine = buildDesk(ctx, { id: 'HD-01', x: MY_DESK.x, z: MY_DESK.z, rotY: MY_DESK.rotY, pcName: MY_DESK.pcName, userName: '', screenState: 'helpdesk', jackLabel: 'HD-01' });
    this.desks.set('HD-01', mine);
    this.registerJack('HD-01', MY_DESK.pcName, mine);
    I.register({
      id: 'my-pc',
      object: mine.pc,
      label: () => 'E — Utiliser le PC (HelpDesk Pro)',
      onInteract: () => A.useMyPc({ pos: mine.screenViewPos, look: mine.screenCenter }),
    });
    I.register({ id: 'tower:HD-01', object: mine.tower, label: () => 'E — Arrière de l’unité centrale', onInteract: () => A.useTower('HD-01', MY_DESK.pcName), maxDistance: 1.8 });
    const phone = buildPhone(mine.root, -0.45, -0.1);
    I.register({ id: 'phone', object: phone, label: () => 'E — Décrocher le téléphone', onInteract: () => A.phone() });
    // Plaque sur le chant avant du bureau
    const nameplate = makeLabel('Support informatique — poste 2222', 0.5, 0.06, { bg: '#1f3b5c', fg: '#fff', px: 500 });
    nameplate.position.set(0, 0.68, 0.402);
    mine.root.add(nameplate);

    const shelf = buildShelf(ctx, SPOTS.shelf.x, SPOTS.shelf.z, Math.PI / 2);
    I.register({ id: 'shelf', object: shelf, label: () => 'E — Consulter le stock de matériel', onInteract: () => A.shelf() });

    // --- Postes utilisateurs + PNJ ---
    for (const d of DESKS) {
      const user = getUser(d.userId);
      const desk = buildDesk(ctx, {
        id: d.id,
        x: d.x,
        z: d.z,
        rotY: d.rotY,
        pcName: d.pcName,
        userName: user ? `${user.firstName} ${user.lastName}` : '',
        screenState: user ? 'desktop' : 'off',
      });
      this.desks.set(d.id, desk);
      I.register({
        id: `pc:${d.id}`,
        object: desk.pc,
        label: () => `E — Utiliser ${d.pcName}`,
        onInteract: () => A.useUserPc(d, { pos: desk.screenViewPos, look: desk.screenCenter }),
      });
      this.registerJack(d.id, d.pcName, desk);
      I.register({ id: `tower:${d.id}`, object: desk.tower, label: () => 'E — Arrière de l’unité centrale', onInteract: () => A.useTower(d.id, d.pcName), maxDistance: 1.8 });
      if (d.printer) {
        // Petit meuble à côté du bureau, avec l'imprimante dessus
        solid.box(mat(0x7a7f87), [0.5, 0.6, 0.45], [-1.0, 0.3, -0.15], desk.frame);
        addCollider(ctx, desk.frame, -1.0, -0.15, 0.5, 0.45);
        const p = buildSmallPrinter(desk.root, -1.0, 0.6, -0.15);
        I.register({ id: `printer:${d.id}`, object: p, label: () => 'E — Examiner l’imprimante', onInteract: () => A.printer(`Imprimante ${d.id}`) });
      }
      if (user) {
        const npc = buildSeatedNpc(user);
        desk.root.add(npc.group);
        this.npcs.push(npc);
        this.seated.set(user.id, npc);
        I.register({ id: `npc:${user.id}`, object: npc.group, label: () => `E — Parler à ${user.firstName}`, onInteract: () => A.talkTo(user) });
      }
    }

    // --- Salle serveur ---
    this.rack = new Rack3D(ctx, SPOTS.rack.x, SPOTS.rack.z, 0);
    I.register({ id: 'rack', object: this.rack.rack, label: () => 'E — Ouvrir la baie', onInteract: () => A.openRack(this.rack) });
    I.register({ id: 'ups', object: this.rack.ups, label: () => 'E — Examiner l’onduleur', onInteract: () => A.inspectUps() });
    // Chemin de câbles au plafond qui part de la baie
    props.box(mat(0x9aa0a6), [0.3, 0.05, 9.2], [SPOTS.rack.x, 2.75, 5.6]);
    props.box(mat(0x9aa0a6), [0.3, 0.05, 0.3], [SPOTS.rack.x, 2.4, 1.0]);
    props.box(mat(0x2d6cdf), [0.2, 0.04, 9], [SPOTS.rack.x, 2.78, 5.6]);
    // Climatisation murale
    props.box(mat(0xf4f4f4), [1.0, 0.3, 0.22], [9.0, 2.5, 0.2]);

    // --- Local copieur ---
    const copier = buildCopier(ctx, SPOTS.copier.x, SPOTS.copier.z, 0);
    I.register({ id: 'copier', object: copier, label: () => 'E — Examiner le copieur', onInteract: () => A.copier() });
    props.box(mat(0xd9b26f), [0.5, 0.3, 0.35], [17.4, 0.15, 0.6]); // ramettes de papier

    // --- Imprimante réseau Compta ---
    const np = buildNetworkPrinter(ctx, SPOTS.networkPrinter.x, SPOTS.networkPrinter.z, -Math.PI / 2);
    I.register({ id: 'netprinter', object: np.printer, label: () => 'E — Examiner l’imprimante IMP-COMPTA', onInteract: () => A.printer('IMP-COMPTA') });
    this.registerJack('P-01', 'IMP-COMPTA', { jack: np.jack, cablePlugged: np.plugged, cableLoose: np.loose });

    // --- Salle de réunion ---
    const tv = buildMeetingRoom(ctx, SPOTS.meetingTable.x, SPOTS.meetingTable.z);
    I.register({ id: 'tv', object: tv, label: () => 'E — Écran de visio', onInteract: () => A.tv() });

    // --- Cafétéria ---
    const coffee = buildCoffeeCorner(ctx, SPOTS.coffee.x - 0.05, SPOTS.coffee.z, -Math.PI / 2);
    I.register({ id: 'coffee', object: coffee, label: () => 'E — Prendre un café', onInteract: () => A.coffee() });
    props.box(mat(0xf0f0f0), [1.2, 0.04, 1.2], [37.2, 0.74, 19.5]);
    props.box(mat(C.deskLeg), [0.08, 0.72, 0.08], [37.2, 0.36, 19.5]);
    this.colliders.push({ minX: 36.6, maxX: 37.8, minZ: 18.9, maxZ: 20.1 });
    props.box(mat(0x2e86c1), [0.4, 1.8, 0.6], [35.4, 0.9, 23.5]); // frigo
    this.colliders.push({ minX: 35.1, maxX: 35.7, minZ: 23.1, maxZ: 23.9 });

    // --- Plantes ---
    for (const [x, z] of [
      [0.5, 10.6],
      [39.5, 13.4],
      [17.6, 10.6],
      [13.4, 23.4],
      [29.5, 15],
      [7.5, 9.4],
      [33.5, 9.4],
    ]) {
      buildPlant(ctx, x, z);
    }

    // --- Bernard, le chef de service, debout dans le bureau helpdesk ---
    this.boss = buildStandingNpc({ shirt: 0x5d4037, skin: 0xe8b996, hair: 0x7a7a7a, pants: 0x263238 }, 'boss');
    this.boss.group.position.set(6.8, 0, 2.2);
    this.boss.group.rotation.y = Math.PI / 2 + 0.4;
    this.root.add(this.boss.group);
    this.npcs.push(this.boss);
    this.colliders.push({ minX: 6.55, maxX: 7.05, minZ: 1.95, maxZ: 2.45 });
    I.register({ id: 'boss', object: this.boss.group, label: () => 'E — Parler à Bernard (chef de service)', onInteract: () => A.talkToBoss() });

    // --- Mini-switch « perso » (scénario de boucle), sous le bureau B-07 ---
    this.miniSwitch = new THREE.Group();
    const msBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.1), mat(0xeeeeee));
    msBody.position.set(0, 0.02, 0);
    const msLeds = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 0.004), new THREE.MeshBasicMaterial({ color: 0xffa000 }));
    msLeds.position.set(0, 0.03, 0.051);
    msLeds.name = 'ms-leds';
    this.miniSwitch.add(msBody, msLeds);
    for (const [tx, tz] of [
      [0.12, 0.92],
      [3.62, 0.92],
    ]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, 0.02, -0.05), new THREE.Vector3(tx * 0.5, 0.01, -0.2), new THREE.Vector3(tx, 0.01, -0.4), new THREE.Vector3(tx, 0.3, -tz + 0.5)]);
      const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.005, 5), mat(0xf2c230));
      cable.name = 'ms-cable';
      this.miniSwitch.add(cable);
    }
    const d7 = DESKS.find((x) => x.id === 'B-07')!;
    this.miniSwitch.position.set(d7.x - 0.3, 0, d7.z - 0.05);
    this.miniSwitch.rotation.y = Math.PI;
    this.miniSwitch.visible = false;
    this.root.add(this.miniSwitch);
    I.register({ id: 'miniswitch', object: this.miniSwitch, label: () => (this.miniSwitch.visible ? 'E — Examiner le petit switch perso' : null), onInteract: () => A.printer('MINI-SWITCH'), maxDistance: 1.8 });

    // On fige les objets statiques en InstancedMesh.
    const propsGroup = props.build('props', true, true);
    const solidGroup = solid.build('solid', true, true);
    this.root.add(propsGroup, solidGroup);
    this.occluders.push(solidGroup);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true;
    });

    // Modèles 3D personnalisés (optionnels)
    this.models.register('coffee', coffee);
    this.models.register('copier', copier);
    this.models.register('shelf', shelf);
    void this.models.loadAll();
  }

  /** Prise murale interactive : son libellé dépend de l'état réel du câble. */
  private registerJack(jackId: string, hostId: string, parts: { jack: THREE.Group; cablePlugged: THREE.Mesh; cableLoose: THREE.Mesh }): void {
    this.jackCables.set(jackId, { host: hostId, plugged: parts.cablePlugged, loose: parts.cableLoose });
    this.interactions.register({
      id: `jack:${jackId}`,
      object: parts.jack,
      label: () => {
        const atJack = this.net.cableAt(`${jackId}:jack`);
        if (atJack && atJack.a.startsWith('SW-PERSO')) return `E — Débrancher le câble du mini-switch (prise ${jackId})`;
        const c = this.net.cableAt(`${hostId}:eth0`);
        if (!c) return `E — Prise ${jackId} (aucun câble)`;
        if (c.b && c.b !== `${jackId}:jack`) return `E — Prise ${jackId}`;
        return c.b ? `E — Débrancher le câble de la prise ${jackId}` : `E — Brancher le câble dans la prise ${jackId}`;
      },
      onInteract: () => this.actions.toggleJack(jackId, hostId),
      maxDistance: 1.6,
    });
    // Le câble lui-même est aussi interactif (on le voit mieux que la prise).
    for (const m of [parts.cablePlugged, parts.cableLoose]) {
      this.interactions.register({
        id: `cable:${jackId}:${m.name}`,
        object: m,
        label: () => (m.visible ? (this.net.cableAt(`${hostId}:eth0`)?.b ? `E — Débrancher le câble de la prise ${jackId}` : `E — Brancher le câble dans la prise ${jackId}`) : null),
        onInteract: () => this.actions.toggleJack(jackId, hostId),
        maxDistance: 1.6,
      });
    }
  }

  /** Répercute l'état du réseau dans le décor : câbles des postes, cordons de la baie, icônes réseau des écrans. */
  syncNetwork(): void {
    this.jackCables.forEach((parts, jackId) => {
      const c = this.net.cableAt(`${parts.host}:eth0`);
      parts.plugged.visible = !!c && c.b === `${jackId}:jack`;
      parts.loose.visible = !!c && !c.b;
    });
    this.rack.syncCables(this.net);
    const ms = this.net.state.switches['SW-PERSO'];
    this.miniSwitch.visible = !!ms && this.net.state.cables.some((c) => c.a.startsWith('SW-PERSO') || c.b?.startsWith('SW-PERSO'));
    this.syncScreens();
  }

  /** État des écrans selon le réseau ET le poste (écran éteint, câble vidéo, session, redémarrage…). */
  syncScreens(): void {
    const hosts: [string, string][] = DESKS.map((d) => [d.id, d.pcName]);
    hosts.push(['HD-01', MY_DESK.pcName]);
    for (const [deskId, hostId] of hosts) {
      const info = this.net.hostIp(hostId);
      const pc = this.office.pc(hostId);
      const screen = this.screens.get(deskId);
      if (!screen || !pc) continue;
      const u = this.office.user(pc.user);
      screen.userName = u ? `${u.firstName} ${u.lastName}` : '';
      let state: Parameters<ScreenManager['setState']>[1];
      let msg: string | undefined;
      if (info.status === 'off' || !pc.monitorOn || pc.monitorDead || !pc.powerCable) state = 'off';
      else if (!pc.videoCable) state = 'nosignal';
      else if (pc.rebootUntil !== null) state = 'boot';
      else if (!u) state = 'lock';
      else if (u.locked || !u.enabled) {
        state = 'lock';
        msg = u.locked ? 'Le compte est verrouillé' : 'Compte désactivé';
      } else if (deskId === 'HD-01') state = 'helpdesk';
      else if (pc.outlook.profileCorrupt) {
        state = 'error';
        msg = 'Impossible de démarrer Microsoft Outlook. Impossible d’ouvrir la fenêtre Outlook.';
      } else state = 'desktop';
      if (screen.state !== state || screen.message !== msg) this.screens.setState(deskId, state, msg);
      this.screens.setNet(deskId, info.status === 'dhcp' || info.status === 'static' ? (pc.released ? 'none' : 'ok') : info.status === 'apipa' ? 'limited' : 'none');
      // LED de la tour : éteinte si le PC est éteint
      const tower = this.desks.get(deskId)?.tower;
      const led = tower?.getObjectByName('power-led') as THREE.Mesh | undefined;
      if (led) (led.material as THREE.MeshBasicMaterial).color.setHex(info.status === 'off' || !pc.powerCable ? 0x222222 : 0x3cff6a);
    }
  }

  /** Un utilisateur vient voir le technicien : il se lève et attend au helpdesk. */
  showVisitor(user: UserDef): void {
    this.hideVisitor();
    const seated = this.seated.get(user.id);
    if (seated) seated.group.visible = false;
    const npc = buildStandingNpc(user, `visitor:${user.id}`);
    npc.group.position.set(5.2, 0, 4.4);
    npc.group.rotation.y = -0.5;
    this.root.add(npc.group);
    this.visitor = { user: user.id, npc };
    this.interactions.register({ id: `visitor:${user.id}`, object: npc.group, label: () => `E — Parler à ${user.firstName} (vient vous voir)`, onInteract: () => this.actions.talkToVisitor(user) });
  }

  hideVisitor(): void {
    if (!this.visitor) return;
    const seated = this.seated.get(this.visitor.user);
    if (seated) seated.group.visible = true;
    this.interactions.unregister(`visitor:${this.visitor.user}`);
    this.root.remove(this.visitor.npc.group);
    this.visitor = null;
  }

  get visitorUser(): string | null {
    return this.visitor?.user ?? null;
  }

  /** Affiche la bulle « ! » au-dessus du chef. */
  setBossBubble(on: boolean): void {
    const b = this.boss.group.getObjectByName('bubble');
    if (b) b.visible = on;
  }

  /** Nombre d'utilisateurs présents. */
  get userCount(): number {
    return USERS.length;
  }

  getDoor(id: string): Door | undefined {
    return this.doors.find((d) => d.def.id === id);
  }

  update(dt: number): void {
    this.time += dt;
    this.rack.updateLeds(this.net, this.time);
    if (this.miniSwitch.visible) {
      const l = this.miniSwitch.getObjectByName('ms-leds') as THREE.Mesh;
      (l.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(this.time * 25) > 0 ? 0xffa000 : 0x332200);
    }
    if (this.visitor) {
      animateNpc(this.visitor.npc, this.time);
      const b = this.visitor.npc.group.getObjectByName('bubble');
      if (b) b.position.y = 2.05 + Math.sin(this.time * 4) * 0.04;
    }
    for (const d of this.doors) d.update(dt);
    for (const n of this.npcs) animateNpc(n, this.time);
  }
}
