/**
 * Construction du mobilier en low poly.
 * - Ce qui est STATIQUE (pieds, chaises, claviers…) va dans un StaticBatcher (instancing).
 * - Ce qui est INTERACTIF (PC, prise, baie…) est un vrai Mesh, pour le raycast et le surlignage.
 * Chaque meuble est décrit dans son repère local : le mur est du côté -z local.
 */
import * as THREE from 'three';
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
  /** Groupe interactif « PC » (écran + tour). */
  pc: THREE.Group;
  /** Prise murale interactive. */
  jack: THREE.Group;
  screen: Screen;
  /** Point regardé quand on s'approche de l'écran (monde). */
  screenCenter: THREE.Vector3;
  /** Position de la caméra devant l'écran (monde). */
  screenViewPos: THREE.Vector3;
  frame: THREE.Matrix4;
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
  const tower = box([0.2, 0.44, 0.45], mat(C.pc), [0.48, 0.22, -0.12]);
  tower.name = 'tower';
  pc.add(tower);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.005), new THREE.MeshBasicMaterial({ color: 0x3cff6a }));
  led.position.set(0.48, 0.38, 0.106);
  pc.add(led);
  root.add(pc);

  // --- Prise murale RJ45 étiquetée ---
  const jack = new THREE.Group();
  jack.name = `jack:${opts.id}`;
  // Placée entre les pieds du bureau, à gauche de la tour pour rester visible en se baissant.
  const JX = 0.12;
  jack.add(box([0.08, 0.12, 0.02], mat(C.jack), [JX, 0.3, -0.415]));
  const port = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.004), mat(0x222222));
  port.position.set(JX, 0.31, -0.404);
  jack.add(port);
  const label = makeLabel(opts.jackLabel ?? opts.id, 0.1, 0.035, { bg: '#ffffff', fg: '#0b3a7a', border: '#0b3a7a', px: 600 });
  label.position.set(JX, 0.39, -0.404);
  jack.add(label);
  root.add(jack);

  // --- Câble RJ45 bleu : arrière de la tour → prise (étape 2 : il deviendra dynamique) ---
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.45, 0.12, -0.345),
    new THREE.Vector3(0.42, 0.015, -0.37),
    new THREE.Vector3(0.25, 0.015, -0.39),
    new THREE.Vector3(JX, 0.12, -0.4),
    new THREE.Vector3(JX, 0.3, -0.404),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.005, 5), mat(C.cableBlue));
  cable.name = 'cable';
  root.add(cable);

  root.updateMatrixWorld(true);
  const screenCenter = new THREE.Vector3(0, 1.08, -0.18).applyMatrix4(frame);
  const screenViewPos = new THREE.Vector3(0, 1.1, 0.42).applyMatrix4(frame);
  return { root, pc, jack, screen, screenCenter, screenViewPos, frame };
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

/** Texture de façade d'un équipement de la baie (ports, LEDs, logo…). */
function deviceTexture(kind: 'patch' | 'switch' | 'router' | 'server' | 'ups' | 'brush', name: string, ports: number): THREE.CanvasTexture {
  const w = 1024;
  const h = kind === 'server' ? 256 : kind === 'ups' ? 384 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const bg = { patch: '#1b1d20', switch: '#2c3e50', router: '#34495e', server: '#2d3033', ups: '#1f2326', brush: '#111' }[kind];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // oreilles de fixation
  ctx.fillStyle = '#555b62';
  ctx.fillRect(0, 0, 40, h);
  ctx.fillRect(w - 40, 0, 40, h);
  ctx.fillStyle = '#c8d0d8';
  ctx.font = 'bold 22px Arial';
  ctx.textBaseline = 'middle';
  if (kind === 'patch' || kind === 'switch') {
    ctx.fillText(name, 52, h / 2);
    const startX = 220;
    const cols = ports / 2;
    const cw = (w - startX - 60) / cols;
    for (let i = 0; i < ports; i++) {
      const col = Math.floor(i / 2);
      const row = i % 2;
      const px = startX + col * cw + 4;
      const py = row === 0 ? 14 : 70;
      ctx.fillStyle = '#0c0d0e';
      ctx.fillRect(px, py, cw - 10, 42);
      ctx.fillStyle = '#9aa4ae';
      ctx.font = '13px Arial';
      ctx.fillText(String(i + 1), px + 2, row === 0 ? py + 52 : py - 7);
    }
  } else if (kind === 'router') {
    ctx.fillText(name, 52, h / 2);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#0c0d0e';
      ctx.fillRect(600 + i * 70, 40, 54, 46);
    }
    ctx.fillStyle = '#3cff6a';
    ctx.beginPath();
    ctx.arc(520, h / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'server') {
    ctx.fillText(name, 52, 40);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = '#44494f';
      ctx.fillRect(260 + i * 85, 30, 75, 190);
      ctx.fillStyle = '#3cff6a';
      ctx.fillRect(268 + i * 85, 200, 10, 8);
    }
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.arc(120, 170, 16, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'ups') {
    ctx.fillText(name, 52, 60);
    ctx.fillStyle = '#7ec8a0';
    ctx.fillRect(420, 120, 220, 110);
    ctx.fillStyle = '#123';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('SECTEUR', 440, 155);
    ctx.fillText('BAT 100%', 440, 200);
  } else {
    ctx.fillStyle = '#000';
    for (let i = 0; i < 60; i++) ctx.fillRect(60 + i * 15, 30, 3, 70);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export interface RackBuild {
  root: THREE.Group;
  rack: THREE.Group;
  ups: THREE.Group;
  /** Hauteur des équipements (pour la vue rapprochée). */
  minY: number;
  maxY: number;
  front: THREE.Vector3; // centre de la façade (monde)
  frontNormal: THREE.Vector3;
}

/** Hauteur d'une unité de baie (exagérée pour la lisibilité). */
const U = 0.06;

/** Baie réseau 19" : panneau de brassage, 2 switchs, routeur, serveur, onduleur. */
export function buildRack(ctx: BuildCtx, x: number, z: number, rotY: number): RackBuild {
  const frame = frameAt(x, z, rotY);
  const root = rootAt(x, z, rotY, 'rack-root');
  const rack = new THREE.Group();
  rack.name = 'rack';
  const W = 0.6;
  const D = 0.9;
  const H = 2.0;
  const body = mat(C.rack);
  // Montants et capots
  rack.add(box([0.04, H, D], body, [-W / 2 + 0.02, H / 2, 0]));
  rack.add(box([0.04, H, D], body, [W / 2 - 0.02, H / 2, 0]));
  rack.add(box([W, 0.05, D], body, [0, H - 0.025, 0]));
  rack.add(box([W, 0.08, D], body, [0, 0.04, 0]));
  rack.add(box([W, H, 0.03], body, [0, H / 2, -D / 2 + 0.015]));
  const frontZ = D / 2 - 0.03;

  const devices: { kind: Parameters<typeof deviceTexture>[0]; name: string; u: number; top: number; ports: number; depth: number }[] = [
    { kind: 'patch', name: 'PP-01', u: 1, top: 1.86, ports: 24, depth: 0.12 },
    { kind: 'brush', name: '', u: 1, top: 1.86 - U, ports: 0, depth: 0.06 },
    { kind: 'switch', name: 'SW-01', u: 1, top: 1.86 - 2 * U, ports: 24, depth: 0.3 },
    { kind: 'switch', name: 'SW-02', u: 1, top: 1.86 - 3 * U, ports: 24, depth: 0.3 },
    { kind: 'router', name: 'RT-FW-01', u: 1, top: 1.86 - 5 * U, ports: 4, depth: 0.35 },
    { kind: 'server', name: 'SRV-01 (AD/DNS/DHCP/Fichiers)', u: 2, top: 1.86 - 7 * U, ports: 0, depth: 0.7 },
    { kind: 'server', name: 'NAS-01 (Sauvegardes)', u: 2, top: 1.86 - 10 * U, ports: 0, depth: 0.5 },
    { kind: 'brush', name: '', u: 1, top: 1.86 - 13 * U, ports: 0, depth: 0.06 },
  ];
  // Panneaux d'obturation dans les emplacements vides
  for (const top of [1.86 - 4 * U, 1.86 - 6 * U, 1.86 - 9 * U, 1.86 - 12 * U]) {
    rack.add(box([W - 0.08, U - 0.004, 0.01], mat(0x15171a), [0, top - U / 2, frontZ - 0.005]));
  }
  for (let i = 0; i < 10; i++) rack.add(box([W - 0.08, U - 0.004, 0.01], mat(0x15171a), [0, 1.86 - (14 + i) * U - U / 2, frontZ - 0.005]));
  for (const d of devices) {
    const h = d.u * U - 0.004;
    const cy = d.top - (d.u * U) / 2;
    rack.add(box([W - 0.1, h, d.depth], mat(0x2a2c30), [0, cy, frontZ - d.depth / 2]));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, h), new THREE.MeshBasicMaterial({ map: deviceTexture(d.kind, d.name, d.ports) }));
    face.position.set(0, cy, frontZ + 0.002);
    face.name = `face:${d.name || d.kind}`;
    rack.add(face);
  }
  root.add(rack);

  // Onduleur en bas de baie (interactif séparément)
  const ups = new THREE.Group();
  ups.name = 'ups';
  const upsH = 4 * U;
  ups.add(box([W - 0.1, upsH, 0.6], mat(0x1f2326), [0, 0.1 + upsH / 2, frontZ - 0.3]));
  const upsFace = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, upsH), new THREE.MeshBasicMaterial({ map: deviceTexture('ups', 'ONDULEUR 3000VA', 0) }));
  upsFace.position.set(0, 0.1 + upsH / 2, frontZ + 0.002);
  ups.add(upsFace);
  root.add(ups);

  ctx.scene.add(root);
  addCollider(ctx, frame, 0, 0, W + 0.05, D + 0.05);
  root.updateMatrixWorld(true);
  const front = new THREE.Vector3(0, 1.2, frontZ).applyMatrix4(frame);
  const frontNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  return { root, rack, ups, minY: 0.3, maxY: 1.8, front, frontNormal };
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
export function buildNetworkPrinter(ctx: BuildCtx, x: number, z: number, rotY: number): THREE.Group {
  const frame = frameAt(x, z, rotY);
  const root = rootAt(x, z, rotY, 'netprinter-root');
  ctx.solid.box(mat(0x7a7f87), [0.7, 0.7, 0.5], [0, 0.35, 0], frame);
  const g = buildSmallPrinter(root, 0, 0.7, 0);
  g.name = 'netprinter';
  const lbl = makeLabel('IMP-COMPTA', 0.3, 0.06, { bg: '#fff', fg: '#333', px: 500 });
  lbl.position.set(0, 0.6, 0.252);
  root.add(lbl);
  ctx.scene.add(root);
  addCollider(ctx, frame, 0, 0, 0.75, 0.55);
  return g;
}
