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
  buildRack,
  buildShelf,
  buildSmallPrinter,
  type BuildCtx,
  type DeskBuild,
  type RackBuild,
} from './furniture';
import { makeLabel } from './labels';
import { C, mat } from './materials';
import { ModelLoader } from './ModelLoader';
import { animateNpc, buildSeatedNpc, type NpcBuild } from './npc';
import { ScreenManager } from './ScreenManager';
import { StaticBatcher } from './StaticBatcher';

export interface FocusView {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export interface WorldActions {
  useMyPc(view: FocusView): void;
  useUserPc(desk: DeskDef, view: FocusView): void;
  inspectJack(desk: DeskDef): void;
  openRack(rack: RackBuild): void;
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
  rack!: RackBuild;
  private npcs: NpcBuild[] = [];
  private time = 0;

  constructor(private interactions: InteractionSystem, private actions: WorldActions) {
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
    I.register({
      id: 'my-pc',
      object: mine.pc,
      label: () => 'E — Utiliser le PC (HelpDesk Pro)',
      onInteract: () => A.useMyPc({ pos: mine.screenViewPos, look: mine.screenCenter }),
    });
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
      I.register({
        id: `jack:${d.id}`,
        object: desk.jack,
        label: () => `E — Examiner la prise ${d.id}`,
        onInteract: () => A.inspectJack(d),
        maxDistance: 1.6,
      });
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
        I.register({ id: `npc:${user.id}`, object: npc.group, label: () => `E — Parler à ${user.firstName}`, onInteract: () => A.talkTo(user) });
      }
    }

    // --- Salle serveur ---
    this.rack = buildRack(ctx, SPOTS.rack.x, SPOTS.rack.z, 0);
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
    I.register({ id: 'netprinter', object: np, label: () => 'E — Examiner l’imprimante IMP-COMPTA', onInteract: () => A.printer('IMP-COMPTA') });

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

    // On fige les objets statiques en InstancedMesh.
    const propsGroup = props.build('props', true, true);
    const solidGroup = solid.build('solid', true, true);
    this.root.add(propsGroup, solidGroup);
    this.occluders.push(solidGroup);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true;
    });

    // Modèles 3D personnalisés (optionnels)
    this.models.register('rack', this.rack.rack);
    this.models.register('coffee', coffee);
    this.models.register('copier', copier);
    this.models.register('shelf', shelf);
    void this.models.loadAll();
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
    for (const d of this.doors) d.update(dt);
    for (const n of this.npcs) animateNpc(n, this.time);
  }
}
