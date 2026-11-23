/** Construit la structure de l'étage : sols, plafond, murs, fenêtres, néons, panneaux. */
import * as THREE from 'three';
import { FLOOR_D, FLOOR_W, OPEN_SIGNS, ROOMS, WALLS, WALL_H, WALL_T, type WallDef } from '../data/map';
import type { BuildCtx } from './furniture';
import { makeLabel } from './labels';
import { C, mat } from './materials';

const DOOR_H = 2.15;

/** Texture de sol en dalles / moquette, générée une fois puis teintée par pièce. */
function floorTexture(): THREE.CanvasTexture {
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  // grain léger
  for (let i = 0; i < 900; i++) {
    const v = 225 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let skyMat: THREE.MeshBasicMaterial | null = null;

/** Vue « extérieure » des fenêtres : dégradé de ciel + silhouettes d'immeubles. */
function skyMaterial(): THREE.MeshBasicMaterial {
  if (skyMat) return skyMat;
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8fc4f0');
  g.addColorStop(1, '#e4f1fb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  let x = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (x < w) {
    const bw = 20 + rnd() * 45;
    const bh = 25 + rnd() * 55;
    const shade = 150 + Math.floor(rnd() * 50);
    ctx.fillStyle = `rgb(${shade - 20},${shade - 5},${shade + 15})`;
    ctx.fillRect(x, h - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let wy = h - bh + 5; wy < h - 6; wy += 9) for (let wx = x + 4; wx < x + bw - 5; wx += 8) ctx.fillRect(wx, wy, 4, 4);
    x += bw + 2 + rnd() * 10;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  skyMat = new THREE.MeshBasicMaterial({ map: tex });
  return skyMat;
}

export function buildFloor(ctx: BuildCtx): void {
  const baseTex = floorTexture();
  for (const r of ROOMS) {
    const w = r.x2 - r.x1;
    const d = r.z2 - r.z1;
    const tex = baseTex.clone();
    tex.repeat.set(w / 0.6, d / 0.6);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: r.floor, map: tex }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.x1 + r.x2) / 2, 0, (r.z1 + r.z2) / 2);
    m.receiveShadow = true;
    m.name = `floor:${r.id}`;
    ctx.scene.add(m);
  }

  // Plafond
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D), mat(C.ceiling));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(FLOOR_W / 2, WALL_H, FLOOR_D / 2);
  ctx.scene.add(ceil);

  // Murs
  for (const w of WALLS) buildWall(ctx, w);

  // Néons au plafond (instanciés, émissifs)
  const neon = mat(C.neon, { emissive: 0xfff8e7, emissiveIntensity: 1 });
  const frameMat = mat(0xb9bec4);
  for (let x = 1; x < FLOOR_W; x += 4) {
    for (const z of [2.5, 7.5, 12, 17, 21.5]) {
      ctx.props.box(frameMat, [1.3, 0.03, 0.4], [x, WALL_H - 0.015, z]);
      ctx.props.box(neon, [1.2, 0.02, 0.3], [x, WALL_H - 0.03, z]);
    }
  }

  // Panneaux au-dessus des ouvertures sans porte
  for (const s of OPEN_SIGNS) addSign(ctx, s.text, s.x, s.z, s.side);
}

/** Panneau de signalétique fixé au-dessus d'une ouverture, côté couloir. */
export function addSign(ctx: BuildCtx, text: string, x: number, z: number, side: 1 | -1): void {
  const sign = makeLabel(text, 1.3, 0.22, { bg: '#1f3b5c', fg: '#ffffff', px: 300 });
  sign.position.set(x, 2.5, z + side * (WALL_T / 2 + 0.006));
  sign.rotation.y = side === 1 ? 0 : Math.PI;
  ctx.scene.add(sign);
}

function buildWall(ctx: BuildCtx, w: WallDef): void {
  const wallMat = mat(w.windows ? C.wallAccent : C.wall);
  const skirt = mat(0x6b6f75);
  // On découpe le segment autour des ouvertures.
  const pieces: [number, number][] = [];
  let cursor = w.from;
  const gaps = [...(w.gaps ?? [])].sort((a, b) => a[0] - b[0]);
  for (const [g1, g2] of gaps) {
    if (g1 > cursor) pieces.push([cursor, g1]);
    cursor = g2;
  }
  if (cursor < w.to) pieces.push([cursor, w.to]);

  const place = (a: number, b: number, y0: number, y1: number, material: THREE.Material, extraT = 0) => {
    const len = b - a;
    const mid = (a + b) / 2;
    const h = y1 - y0;
    if (w.axis === 'x') ctx.solid.box(material, [len, h, WALL_T + extraT], [mid, y0 + h / 2, w.at]);
    else ctx.solid.box(material, [WALL_T + extraT, h, len], [w.at, y0 + h / 2, mid]);
  };

  for (const [a0, b0] of pieces) {
    // Prolonge légèrement aux extrémités pour fermer les angles.
    const a = a0 === w.from ? a0 - WALL_T / 2 : a0;
    const b = b0 === w.to ? b0 + WALL_T / 2 : b0;
    place(a, b, 0, WALL_H, wallMat);
    place(a, b, 0, 0.08, skirt, 0.02);
    if (w.axis === 'x') ctx.colliders.push({ minX: a, maxX: b, minZ: w.at - WALL_T / 2, maxZ: w.at + WALL_T / 2 });
    else ctx.colliders.push({ minX: w.at - WALL_T / 2, maxX: w.at + WALL_T / 2, minZ: a, maxZ: b });
  }
  // Linteaux au-dessus des ouvertures + encadrements
  for (const [g1, g2] of gaps) {
    place(g1, g2, DOOR_H, WALL_H, wallMat);
    const frameMat = mat(C.doorFrame);
    if (w.axis === 'x') {
      ctx.props.box(frameMat, [0.05, DOOR_H, WALL_T + 0.04], [g1 + 0.025, DOOR_H / 2, w.at]);
      ctx.props.box(frameMat, [0.05, DOOR_H, WALL_T + 0.04], [g2 - 0.025, DOOR_H / 2, w.at]);
      ctx.props.box(frameMat, [g2 - g1, 0.05, WALL_T + 0.04], [(g1 + g2) / 2, DOOR_H, w.at]);
    }
  }

  // Fenêtres sur les façades : bandeaux lumineux « ciel » + montants.
  if (w.windows && w.axis === 'x') {
    const sky = skyMaterial();
    const mullion = mat(0x5c6168);
    const side = w.at === 0 ? 1 : -1; // côté intérieur
    const zFace = w.at + side * (WALL_T / 2 + 0.005);
    const breaks = [0, 8, 14, 18, 28, 34, 40]; // jonctions des cloisons
    const southBreaks = [0, 14, 30, 35, 40];
    const list = w.at === 0 ? breaks : southBreaks;
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i] + 0.4;
      const b = list[i + 1] - 0.4;
      ctx.props.box(sky, [b - a, 1.3, 0.01], [(a + b) / 2, 1.75, zFace]);
      ctx.props.box(mullion, [b - a + 0.06, 0.06, 0.04], [(a + b) / 2, 1.08, zFace]);
      ctx.props.box(mullion, [b - a + 0.06, 0.06, 0.04], [(a + b) / 2, 2.42, zFace]);
      for (let x = a; x <= b + 0.01; x += (b - a) / Math.max(1, Math.round((b - a) / 1.3))) {
        ctx.props.box(mullion, [0.05, 1.36, 0.04], [x, 1.75, zFace]);
      }
    }
  }
}
