/**
 * Construction du mobilier en low poly.
 * - Ce qui est STATIQUE (pieds, chaises, claviers…) va dans un StaticBatcher (instancing).
 * - Ce qui est INTERACTIF (PC, prise, baie…) est un vrai Mesh, pour le raycast et le surlignage.
 * Chaque meuble est décrit dans son repère local : le mur est du côté -z local.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AABB2 } from './collision';
import { C, mat } from './materials';
import { makeLabel, makeTextTexture } from './labels';
import { StaticBatcher, frameAt } from './StaticBatcher';
import type { Screen, ScreenManager, ScreenState } from './ScreenManager';

export interface BuildCtx {
  scene: THREE.Group;
  /** Objets statiques qui ne bloquent pas le regard. */
  props: StaticBatcher;
  /** Objets statiques qui bloquent le raycast (murs, plateaux). */
  solid: StaticBatcher;
  colliders: AABB2[];
  screens: ScreenManager;
}

/** Ajoute une boîte de collision définie dans le repère local d'un meuble. */
export function addCollider(ctx: BuildCtx, frame: THREE.Matrix4, cx: number, cz: number, sx: number, sz: number): AABB2 {
  const pts = [
    new THREE.Vector3(cx - sx / 2, 0, cz - sz / 2),
    new THREE.Vector3(cx + sx / 2, 0, cz + sz / 2),
  ].map((p) => p.applyMatrix4(frame));
  const box: AABB2 = {
    minX: Math.min(pts[0].x, pts[1].x),
    maxX: Math.max(pts[0].x, pts[1].x),
    minZ: Math.min(pts[0].z, pts[1].z),
    maxZ: Math.max(pts[0].z, pts[1].z),
  };
  ctx.colliders.push(box);
  return box;
}

function box(size: [number, number, number], material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.position.set(...pos);
  m.castShadow = true;
  return m;
}

function rootAt(x: number, z: number, rotY: number, name: string): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.name = name;
  return g;
}

/** Une chaise de bureau (statique). */
export function buildChair(ctx: BuildCtx, frame: THREE.Matrix4, lx: number, lz: number, faceAway = false): void {
  const dir = faceAway ? -1 : 1;
  ctx.props.box(mat(C.chairSeat), [0.48, 0.08, 0.48], [lx, 0.47, lz], frame);
  ctx.props.box(mat(C.chairSeat), [0.46, 0.5, 0.06], [lx, 0.8, lz + 0.24 * dir], frame);
  ctx.props.box(mat(C.chair), [0.06, 0.4, 0.06], [lx, 0.25, lz], frame);
  ctx.props.box(mat(C.chair), [0.55, 0.04, 0.07], [lx, 0.04, lz], frame);
  ctx.props.box(mat(C.chair), [0.07, 0.04, 0.55], [lx, 0.04, lz], frame);
}

export interface DeskBuild {
  root: THREE.Group;
  /** Groupe interactif « PC » (écran). */
  pc: THREE.Group;
  /** Unité centrale. */
  tower: THREE.Group;
  /** Prise murale interactive. */
  jack: THREE.Group;
  screen: Screen;
  /** Point regardé quand on s'approche de l'écran (monde). */
  screenCenter: THREE.Vector3;
  /** Position de la caméra devant l'écran (monde). */
  screenViewPos: THREE.Vector3;
  frame: THREE.Matrix4;
  /** Câble du poste branché dans la prise / débranché au sol. */
  cablePlugged: THREE.Mesh;
  cableLoose: THREE.Mesh;
}

/**
 * Un poste de travail complet : bureau, chaise, écran, tour, clavier,
 * prise murale étiquetée et câble RJ45 entre la tour et la prise.
 */
export function buildDesk(
  ctx: BuildCtx,
  opts: { id: string; x: number; z: number; rotY: number; pcName: string; userName: string; screenState: ScreenState; jackLabel?: string },
): DeskBuild {
  const frame = frameAt(opts.x, opts.z, opts.rotY);
  const root = rootAt(opts.x, opts.z, opts.rotY, `desk:${opts.id}`);
  ctx.scene.add(root);

  // Plateau (bloque le regard → on ne voit la prise qu'en se baissant) et pieds.
  ctx.solid.box(mat(C.desk), [1.4, 0.04, 0.8], [0, 0.73, 0], frame);
  ctx.props.box(mat(C.deskLeg), [0.04, 0.71, 0.74], [-0.66, 0.355, 0], frame);
  ctx.props.box(mat(C.deskLeg), [0.04, 0.71, 0.74], [0.66, 0.355, 0], frame);
  ctx.props.box(mat(C.deskLeg), [1.28, 0.06, 0.02], [0, 0.66, -0.36], frame);
  // Clavier + souris + petits accessoires
  ctx.props.box(mat(C.keyboard), [0.44, 0.02, 0.14], [-0.02, 0.76, 0.1], frame);
  ctx.props.box(mat(C.keyboard), [0.06, 0.025, 0.1], [0.3, 0.76, 0.1], frame);
  ctx.props.box(mat(0xf5f5f0), [0.21, 0.01, 0.3], [-0.5, 0.755, 0.05], frame, 0.2);
  buildChair(ctx, frame, 0, 0.62);
  addCollider(ctx, frame, 0, 0, 1.4, 0.8);
  addCollider(ctx, frame, 0, 0.62, 0.55, 0.55);

  // --- PC interactif : écran + tour ---
  const pc = new THREE.Group();
  pc.name = `pc:${opts.id}`;
  pc.add(box([0.25, 0.02, 0.18], mat(C.monitor), [0, 0.76, -0.2]));
  pc.add(box([0.06, 0.14, 0.05], mat(C.monitor), [0, 0.84, -0.21]));
  pc.add(box([0.62, 0.38, 0.03], mat(C.monitor), [0, 1.08, -0.2]));
  const screen = ctx.screens.create(opts.id, opts.pcName, opts.userName, opts.screenState);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34), screen.material);
  screenMesh.position.set(0, 1.08, -0.184);
  screenMesh.name = 'screen';
  pc.add(screenMesh);
  root.add(pc);
  // Unité centrale : interactive séparément (arrière du PC : câbles, ouverture du boîtier)
  const tower = new THREE.Group();
  tower.name = `tower:${opts.id}`;
  tower.add(box([0.2, 0.44, 0.45], mat(C.pc), [0.48, 0.22, -0.12]));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.005), new THREE.MeshBasicMaterial({ color: 0x3cff6a }));
  led.position.set(0.48, 0.38, 0.106);
  led.name = 'power-led';
  tower.add(led);
  root.add(tower);

  // --- Prise murale RJ45 étiquetée + câble du poste ---
  // Placée entre les pieds du bureau, à gauche de la tour pour rester visible en se baissant.
  const jackParts = buildJackAndCable(root, {
    label: opts.jackLabel ?? opts.id,
    jack: new THREE.Vector3(0.12, 0.3, -0.415),
    from: new THREE.Vector3(0.45, 0.12, -0.345),
  });
  const jack = jackParts.jack;
  jack.name = `jack:${opts.id}`;

  root.updateMatrixWorld(true);
  const screenCenter = new THREE.Vector3(0, 1.08, -0.18).applyMatrix4(frame);
  const screenViewPos = new THREE.Vector3(0, 1.1, 0.42).applyMatrix4(frame);
  return { root, pc, tower, jack, screen, screenCenter, screenViewPos, frame, cablePlugged: jackParts.plugged, cableLoose: jackParts.loose };
}

/**
 * Prise murale (face vers +z local) et câble RJ45 depuis un équipement.
 * Deux versions du câble : branché dans la prise, ou débranché et posé au sol.
 */
export function buildJackAndCable(
  parent: THREE.Group,
  opts: { label: string; jack: THREE.Vector3; from: THREE.Vector3; color?: number },
): { jack: THREE.Group; plugged: THREE.Mesh; loose: THREE.Mesh } {
  const J = opts.jack;
  const jack = new THREE.Group();
  jack.add(box([0.08, 0.12, 0.02], mat(C.jack), [J.x, J.y, J.z]));
  const port = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.004), mat(0x222222));
  port.position.set(J.x, J.y + 0.01, J.z + 0.011);
  jack.add(port);
  const label = makeLabel(opts.label, 0.1, 0.035, { bg: '#ffffff', fg: '#0b3a7a', border: '#0b3a7a', px: 600 });
  label.position.set(J.x, J.y + 0.09, J.z + 0.011);
  jack.add(label);
  parent.add(jack);

  const cableMat = mat(opts.color ?? C.cableBlue);
  const F = opts.from;
  const plugCurve = new THREE.CatmullRomCurve3([
    F.clone(),
    new THREE.Vector3(F.x - 0.03, 0.015, F.z - 0.025),
    new THREE.Vector3((F.x + J.x) / 2, 0.015, J.z + 0.025),
    new THREE.Vector3(J.x, J.y - 0.18, J.z + 0.015),
    new THREE.Vector3(J.x, J.y + 0.01, J.z + 0.012),
  ]);
  const plugged = new THREE.Mesh(withPlug(new THREE.TubeGeometry(plugCurve, 24, 0.005, 5), new THREE.Vector3(J.x, J.y + 0.01, J.z + 0.02)), cableMat);
  plugged.name = 'cable-plugged';
  // Câble débranché : il traîne au sol devant la prise.
  const endPos = new THREE.Vector3(J.x + 0.06, 0.012, J.z + 0.16);
  const looseCurve = new THREE.CatmullRomCurve3([
    F.clone(),
    new THREE.Vector3(F.x - 0.03, 0.015, F.z - 0.02),
    new THREE.Vector3((F.x + endPos.x) / 2, 0.012, (F.z + endPos.z) / 2 + 0.05),
    endPos,
  ]);
  const loose = new THREE.Mesh(withPlug(new THREE.TubeGeometry(looseCurve, 20, 0.005, 5), endPos.clone().add(new THREE.Vector3(0.012, 0, 0.004))), cableMat);
  loose.name = 'cable-loose';
  loose.visible = false;
  parent.add(plugged, loose);
  return { jack, plugged, loose };
}

/** Ajoute une fiche RJ45 au bout d'un tube. */
function withPlug(tube: THREE.BufferGeometry, at: THREE.Vector3): THREE.BufferGeometry {
  const plug = new THREE.BoxGeometry(0.016, 0.014, 0.028);
  plug.translate(at.x, at.y, at.z);
  const merged = mergeGeometries([tube.toNonIndexed(), plug.toNonIndexed()]);
  tube.dispose();
  plug.dispose();
  return merged;
}

/** Petit téléphone de bureau (interactif). */
export function buildPhone(parent: THREE.Group, lx: number, lz: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'phone';
  g.add(box([0.2, 0.05, 0.18], mat(0x2a2d31), [lx, 0.775, lz]));
  g.add(box([0.2, 0.04, 0.05], mat(0x1d1f22), [lx, 0.815, lz - 0.05]));
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.04), new THREE.MeshBasicMaterial({ color: 0x8fd3ff }));
  screen.position.set(lx + 0.04, 0.803, lz + 0.03);
  g.add(screen);
  parent.add(g);
  return g;
}

/** Imprimante de bureau posée sur un plan de travail. */
export function buildSmallPrinter(parent: THREE.Group, lx: number, ly: number, lz: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'printer';
  g.add(box([0.42, 0.22, 0.36], mat(0xe9eaec), [lx, ly + 0.11, lz]));
  g.add(box([0.3, 0.02, 0.12], mat(0xcfd2d6), [lx, ly + 0.22, lz + 0.14]));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.005), new THREE.MeshBasicMaterial({ color: 0x3cff6a }));
  led.position.set(lx + 0.15, ly + 0.18, lz + 0.181);
  g.add(led);
  parent.add(g);
  return g;
}

/** Étagère de stock du helpdesk, avec des cartons de matériel. */
export function buildShelf(ctx: BuildCtx, x: number, z: number, rotY: number): THREE.Group {
  const frame = frameAt(x, z, rotY);
  const root = rootAt(x, z, rotY, 'shelf');
  const g = new THREE.Group();
  g.name = 'shelf';
  const metal = mat(0x6d7680);
  for (const sx of [-0.88, 0.88]) g.add(box([0.04, 2, 0.45], metal, [sx, 1, 0]));
  const colors = [0xd9b26f, 0x4f81bd, 0xc9c9c9, 0xd9b26f, 0x2b2b2b, 0xe0e0e0, 0x9bbb59, 0xd9b26f];
  for (let i = 0; i < 4; i++) {
    const y = 0.15 + i * 0.5;
    g.add(box([1.76, 0.03, 0.45], metal, [0, y, 0]));
    // Cartons et matériel posés sur l'étagère
    for (let k = 0; k < 4; k++) {
      const c = colors[(i * 3 + k) % colors.length];
      const w = 0.25 + ((i + k) % 3) * 0.08;
      const h = 0.18 + ((i * k) % 3) * 0.06;
      g.add(box([w, h, 0.32], mat(c), [-0.62 + k * 0.42, y + 0.015 + h / 2, 0.02]));
    }
  }
  const sign = makeLabel('STOCK MATÉRIEL', 0.8, 0.12, { bg: '#ffd84d', fg: '#222', px: 400 });
  sign.position.set(0, 2.08, 0.23);
  g.add(sign);
  root.add(g);
  ctx.scene.add(root);
  addCollider(ctx, frame, 0, 0, 1.85, 0.5);
  return g;
}

/** Copieur multifonction. */
export function buildCopier(ctx: BuildCtx, x: number, z: number, rotY: number): THREE.Group {
  const frame = frameAt(x, z, rotY);
  const root = rootAt(x, z, rotY, 'copier-root');
  const g = new THREE.Group();
  g.name = 'copier';
  g.add(box([0.65, 0.95, 0.6], mat(0xdfe2e6), [0, 0.475, 0]));
  g.add(box([0.65, 0.12, 0.55], mat(0xc4c8cd), [0, 1.01, -0.02]));
  g.add(box([0.45, 0.03, 0.35], mat(0xf0f0f0), [0.05, 0.9, 0.31]));
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: 0x5aa9e6 }));
  panel.position.set(-0.2, 1.08, 0.24);
  g.add(panel);
  for (let i = 0; i < 3; i++) g.add(box([0.6, 0.005, 0.01], mat(0x9aa0a6), [0, 0.2 + i * 0.22, 0.301]));
  root.add(g);
  ctx.scene.add(root);
  addCollider(ctx, frame, 0, 0, 0.7, 0.65);
  return g;
}

/** Comptoir + machine à café. */
export function buildCoffeeCorner(ctx: BuildCtx, x: number, z: number, rotY: number): THREE.Group {
  const frame = frameAt(x, z, rotY);
  const root = rootAt(x, z, rotY, 'coffee-root');
  ctx.solid.box(mat(0x8a6f50), [2.4, 0.9, 0.6], [0, 0.45, -0.05], frame);
  ctx.props.box(mat(0xd8d2c8), [2.45, 0.04, 0.65], [0, 0.92, -0.05], frame);
  // Petits gobelets et sucre
  ctx.props.box(mat(0xffffff), [0.07, 0.1, 0.07], [0.6, 0.99, 0.05], frame);
  ctx.props.box(mat(0xffffff), [0.07, 0.1, 0.07], [0.7, 0.99, 0.05], frame);
  ctx.props.box(mat(0xc0392b), [0.12, 0.16, 0.08], [-0.7, 1.02, -0.1], frame);
  const g = new THREE.Group();
  g.name = 'coffee';
  g.add(box([0.38, 0.55, 0.4], mat(0x2b2b2b), [0, 1.215, -0.1]));
  g.add(box([0.3, 0.12, 0.05], mat(0x4a4a4a), [0, 1.36, 0.12]));
  g.add(box([0.12, 0.04, 0.08], mat(0x777777), [0, 1.18, 0.1]));
  g.add(box([0.06, 0.08, 0.06], mat(0xf5f5f5), [0, 0.98, 0.07]));
  const tex = makeTextTexture('☕ CAFÉ', 256, 64, { bg: '#4a2c1a', fg: '#ffd9a0' });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), new THREE.MeshBasicMaterial({ map: tex }));
  lbl.position.set(0, 1.42, 0.101);
  g.add(lbl);
  root.add(g);
  ctx.scene.add(root);
  addCollider(ctx, frame, 0, -0.05, 2.45, 0.65);
  return g;
}

/** Plante verte décorative (statique). */
export function buildPlant(ctx: BuildCtx, x: number, z: number): void {
  ctx.props.box(mat(C.plantPot), [0.4, 0.4, 0.4], [x, 0.2, z]);
  ctx.props.box(mat(C.plant), [0.5, 0.6, 0.5], [x, 0.7, z], undefined, 0.4);
  ctx.props.box(mat(0x4f9a4f), [0.35, 0.45, 0.35], [x, 1.1, z], undefined, 1.1);
  ctx.colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
}

/** Salle de réunion : grande table, chaises, écran mural de visio. */
export function buildMeetingRoom(ctx: BuildCtx, x: number, z: number): THREE.Group {
  ctx.solid.box(mat(0x8d6e51), [4, 0.05, 1.6], [x, 0.74, z]);
  ctx.props.box(mat(C.deskLeg), [0.2, 0.72, 1.0], [x - 1.5, 0.36, z]);
  ctx.props.box(mat(C.deskLeg), [0.2, 0.72, 1.0], [x + 1.5, 0.36, z]);
  ctx.colliders.push({ minX: x - 2, maxX: x + 2, minZ: z - 0.8, maxZ: z + 0.8 });
  for (let i = 0; i < 4; i++) {
    const cx = x - 1.5 + i;
    buildChair(ctx, frameAt(cx, z - 1.15, Math.PI), 0, 0);
    buildChair(ctx, frameAt(cx, z + 1.15, 0), 0, 0);
  }
  // Écran mural (mur nord)
  const tv = new THREE.Group();
  tv.name = 'tv';
  tv.add(box([1.9, 1.1, 0.06], mat(0x111111), [x, 1.7, 0.11]));
  const screen = ctx.screens.create('tv-reunion', 'TV-REUNION', '', 'tv');
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), screen.material);
  plane.position.set(x, 1.7, 0.142);
  tv.add(plane);
  ctx.scene.add(tv);
  return tv;
}

/** Imprimante réseau sur meuble bas. */
export function buildNetworkPrinter(
  ctx: BuildCtx,
  x: number,
  z: number,
  rotY: number,
): { printer: THREE.Group; jack: THREE.Group; plugged: THREE.Mesh; loose: THREE.Mesh } {
  const frame = frameAt(x, z, rotY);
  const root = rootAt(x, z, rotY, 'netprinter-root');
  ctx.solid.box(mat(0x7a7f87), [0.7, 0.7, 0.5], [0, 0.35, 0], frame);
  const g = buildSmallPrinter(root, 0, 0.7, 0);
  g.name = 'netprinter';
  const lbl = makeLabel('IMP-COMPTA', 0.3, 0.06, { bg: '#fff', fg: '#333', px: 500 });
  lbl.position.set(0, 0.6, 0.252);
  root.add(lbl);
  // Prise murale P-01 derrière le meuble, à côté
  const jp = buildJackAndCable(root, { label: 'P-01', jack: new THREE.Vector3(0.5, 0.3, -0.505), from: new THREE.Vector3(0.1, 0.75, -0.18), color: 0x9aa0a6 });
  jp.jack.name = 'jack:P-01';
  ctx.scene.add(root);
  addCollider(ctx, frame, 0, 0, 0.75, 0.55);
  return { printer: g, ...jp };
}
