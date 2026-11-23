/**
 * Baie réseau 3D branchée sur le moteur réseau :
 * - les équipements sont construits d'après data/rack.ts,
 * - chaque port a une position précise (sélection au clic / au doigt),
 * - les LED reflètent l'état réel des ports (InstancedMesh à couleurs par instance),
 * - les cordons de brassage sont dessinés en 3D (courbe qui pend un peu).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  PATCH_COLORS,
  RACK_D,
  RACK_DEVICES,
  RACK_FRONT_Z,
  RACK_H,
  RACK_U,
  RACK_W,
  deviceCenterY,
  rackPortPosition,
  type RackDeviceDef,
} from '../data/rack';
import type { Network } from '../network/Network';
import { splitRef } from '../network/Network';
import type { PortRef } from '../network/types';
import type { BuildCtx } from './furniture';
import { addCollider } from './furniture';
import { C, mat } from './materials';
import { frameAt } from './StaticBatcher';

const FACE_W = RACK_W - 0.08;
const HOLE = new THREE.Vector3(0.0125, 0.0105, 0.006);

function box(size: [number, number, number], material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.position.set(...pos);
  m.castShadow = true;
  return m;
}

/** Façade dessinée (nom, numéros de ports, décor) — les trous des ports sont de vrais objets 3D. */
function faceTexture(d: RackDeviceDef): THREE.CanvasTexture {
  const w = 1024;
  const h = d.heightU * 128;
  const faceH = d.heightU * RACK_U - 0.004;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const bg = { patch: '#1b1d20', switch: '#2c3e50', router: '#34495e', server: '#2d3033', nas: '#33373b', brush: '#111', blank: '#15171a' }[d.kind];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#555b62';
  ctx.fillRect(0, 0, 36, h);
  ctx.fillRect(w - 36, 0, 36, h);
  const px = (x: number) => (x / FACE_W + 0.5) * w;
  const py = (y: number) => (0.5 - y / faceH) * h;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#dfe6ee';
  ctx.font = 'bold 26px Arial';
  if (d.kind === 'brush') {
    ctx.fillStyle = '#000';
    for (let i = 0; i < 60; i++) ctx.fillRect(60 + i * 15, 30, 3, 70);
  } else if (d.kind !== 'blank') {
    ctx.fillText(d.label.split(' ')[0], 50, d.kind === 'server' || d.kind === 'nas' ? 50 : h / 2);
  }
  if (d.kind === 'server' || d.kind === 'nas') {
    ctx.font = '18px Arial';
    ctx.fillStyle = '#9aa4ae';
    ctx.fillText(d.label.split(' ').slice(1).join(' '), 50, 85);
    const bays = d.kind === 'server' ? 8 : 4;
    for (let i = 0; i < bays; i++) {
      ctx.fillStyle = '#44494f';
      ctx.fillRect(260 + i * 70, 30, 60, 190);
      ctx.fillStyle = '#3cff6a';
      ctx.fillRect(266 + i * 70, 200, 10, 8);
    }
  }
  // Numéros de ports
  ctx.fillStyle = '#c8d0d8';
  ctx.font = '15px Arial';
  ctx.textAlign = 'center';
  for (const p of d.ports) {
    const label = d.kind === 'switch' ? p.name.replace(/^Fa0\//, '').replace(/^Gi0\//, 'G') : d.kind === 'patch' ? p.name : p.name;
    const below = d.kind === 'switch' && p.y < 0;
    ctx.fillText(label, px(p.x), py(p.y) + (below ? 34 : -34));
  }
  if (d.kind === 'switch') {
    ctx.textAlign = 'left';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#9aa4ae';
    ctx.fillText('SYST', 168, 40);
    ctx.fillText('CONSOLE', 150, 98);
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(160, 80, 40, 8);
  }
  if (d.kind === 'patch') {
    // Bandeau d'étiquettes blanches sous les ports
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(px(-0.18), py(-0.019), px(0.24) - px(-0.18), 14);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

interface PortSlot {
  ref: PortRef;
  local: THREE.Vector3;
  led: number; // index de LED, -1 si aucune (panneau)
}

export class Rack3D {
  readonly root: THREE.Group;
  readonly rack = new THREE.Group();
  readonly ups = new THREE.Group();
  readonly front: THREE.Vector3;
  readonly frontNormal: THREE.Vector3;
  readonly minY = 1.1;
  readonly maxY = 1.85;
  private slots: PortSlot[] = [];
  private leds: THREE.InstancedMesh;
  private ledRefs: (PortRef | 'syst:SW-01' | 'syst:SW-02')[] = [];
  private cables = new THREE.Group();
  private hoverMarker: THREE.Mesh;
  private selectMarker: THREE.Mesh;
  private ledColor = new THREE.Color();
  private statusCache: { version: number; status: Map<string, string> } = { version: -1, status: new Map() };

  constructor(ctx: BuildCtx, x: number, z: number, rotY: number) {
    const frame = frameAt(x, z, rotY);
    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    this.root.rotation.y = rotY;
    this.root.name = 'rack-root';
    this.rack.name = 'rack';

    const body = mat(C.rack);
    this.rack.add(box([0.04, RACK_H, RACK_D], body, [-RACK_W / 2 + 0.02, RACK_H / 2, 0]));
    this.rack.add(box([0.04, RACK_H, RACK_D], body, [RACK_W / 2 - 0.02, RACK_H / 2, 0]));
    this.rack.add(box([RACK_W, 0.05, RACK_D], body, [0, RACK_H - 0.025, 0]));
    this.rack.add(box([RACK_W, 0.08, RACK_D], body, [0, 0.04, 0]));
    this.rack.add(box([RACK_W, RACK_H, 0.03], body, [0, RACK_H / 2, -RACK_D / 2 + 0.015]));

    // Équipements
    const holes: THREE.Matrix4[] = [];
    const ledMatrices: THREE.Matrix4[] = [];
    for (const d of RACK_DEVICES) {
      const h = d.heightU * RACK_U - 0.004;
      const cy = deviceCenterY(d);
      if (d.kind !== 'blank') this.rack.add(box([RACK_W - 0.1, h, d.depth], mat(0x2a2c30), [0, cy, RACK_FRONT_Z - d.depth / 2]));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(FACE_W, h), new THREE.MeshBasicMaterial({ map: faceTexture(d) }));
      face.position.set(0, cy, RACK_FRONT_Z + 0.002);
      face.name = `face:${d.id}`;
      this.rack.add(face);
      for (const p of d.ports) {
        const local = new THREE.Vector3(p.x, cy + p.y, RACK_FRONT_Z + 0.004);
        holes.push(new THREE.Matrix4().compose(local, new THREE.Quaternion(), HOLE));
        let led = -1;
        if (d.kind !== 'patch') {
          led = ledMatrices.length;
          const lp = new THREE.Vector3(p.x - 0.003, cy + p.y + 0.0082, RACK_FRONT_Z + 0.0045);
          ledMatrices.push(new THREE.Matrix4().compose(lp, new THREE.Quaternion(), new THREE.Vector3(0.0065, 0.0035, 0.003)));
          this.ledRefs.push(`${d.id}:${p.name}`);
        }
        this.slots.push({ ref: `${d.id}:${p.name}`, local, led });
      }
      if (d.kind === 'switch') {
        const lp = new THREE.Vector3(-FACE_W / 2 + 0.083, cy + 0.0085, RACK_FRONT_Z + 0.0045);
        ledMatrices.push(new THREE.Matrix4().compose(lp, new THREE.Quaternion(), new THREE.Vector3(0.006, 0.004, 0.003)));
        this.ledRefs.push(`syst:${d.id}` as 'syst:SW-01');
      }
    }
    const holeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0x0b0c0d), holes.length);
    holes.forEach((m, i) => holeMesh.setMatrixAt(i, m));
    holeMesh.name = 'ports';
    this.rack.add(holeMesh);
    this.leds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), ledMatrices.length);
    ledMatrices.forEach((m, i) => {
      this.leds.setMatrixAt(i, m);
      this.leds.setColorAt(i, new THREE.Color(0x111111));
    });
    this.leds.name = 'leds';
    this.root.add(this.leds);

    // Marqueurs de survol / sélection de port
    this.hoverMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.019, 0.016, 0.002),
      new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.85, depthTest: false }),
    );
    this.hoverMarker.visible = false;
    this.hoverMarker.renderOrder = 10;
    this.selectMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.017, 0.002),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.selectMarker.visible = false;
    this.selectMarker.renderOrder = 10;
    this.root.add(this.hoverMarker, this.selectMarker, this.cables);
    this.root.add(this.rack);

    // Onduleur en bas de baie (interactif séparément)
    this.ups.name = 'ups';
    const upsH = 4 * RACK_U;
    this.ups.add(box([RACK_W - 0.1, upsH, 0.6], mat(0x1f2326), [0, 0.1 + upsH / 2, RACK_FRONT_Z - 0.3]));
    const upsFace = new THREE.Mesh(new THREE.PlaneGeometry(FACE_W, upsH), new THREE.MeshBasicMaterial({ map: upsTexture() }));
    upsFace.position.set(0, 0.1 + upsH / 2, RACK_FRONT_Z + 0.002);
    this.ups.add(upsFace);
    this.root.add(this.ups);

    ctx.scene.add(this.root);
    addCollider(ctx, frame, 0, 0, RACK_W + 0.05, RACK_D + 0.05);
    this.root.updateMatrixWorld(true);
    this.front = new THREE.Vector3(0, 1.5, RACK_FRONT_Z).applyMatrix4(frame);
    this.frontNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  }

  /** Port le plus proche d'un point de l'écran (en pixels), dans un rayon donné. */
  pickPort(clientX: number, clientY: number, camera: THREE.Camera, radiusPx: number): PortRef | null {
    const v = new THREE.Vector3();
    let best: PortRef | null = null;
    let bestD = radiusPx;
    for (const s of this.slots) {
      v.copy(s.local).applyMatrix4(this.root.matrixWorld).project(camera);
      if (v.z > 1) continue;
      const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bestD) {
        bestD = d;
        best = s.ref;
      }
    }
    return best;
  }

  /** Cordon sous le pointeur (raycast). */
  pickCable(raycaster: THREE.Raycaster): string | null {
    const hit = raycaster.intersectObject(this.cables, true)[0];
    return (hit?.object.userData.cableId as string | undefined) ?? null;
  }

  private slot(ref: PortRef | null): PortSlot | undefined {
    return ref ? this.slots.find((s) => s.ref === ref) : undefined;
  }

  setHover(ref: PortRef | null): void {
    const s = this.slot(ref);
    this.hoverMarker.visible = !!s;
    if (s) this.hoverMarker.position.copy(s.local).setZ(s.local.z + 0.004);
  }

  setSelected(ref: PortRef | null): void {
    const s = this.slot(ref);
    this.selectMarker.visible = !!s;
    if (s) this.selectMarker.position.copy(s.local).setZ(s.local.z + 0.005);
  }

  /** Redessine tous les cordons dont les deux bouts sont dans la baie. */
  syncCables(net: Network): void {
    for (const child of [...this.cables.children]) {
      (child as THREE.Mesh).geometry.dispose();
      this.cables.remove(child);
    }
    for (const c of net.state.cables) {
      if (!c.b) continue;
      const a = this.localOf(c.a);
      const b = this.localOf(c.b);
      if (!a || !b) continue;
      const color = PATCH_COLORS.find((p) => p.id === c.color)?.hex ?? 0x2d6cdf;
      const geo = cableGeometry(a, b, c.length);
      const mesh = new THREE.Mesh(geo, mat(color));
      mesh.userData.cableId = c.id;
      mesh.castShadow = true;
      this.cables.add(mesh);
    }
  }

  private localOf(ref: PortRef): THREE.Vector3 | null {
    const [d, p] = splitRef(ref);
    const pos = rackPortPosition(d, p);
    return pos ? new THREE.Vector3(pos.x, pos.y, pos.z + 0.004) : null;
  }

  /** LED : vert = lien, clignotement = activité, orange = problème / redémarrage, éteint = rien. */
  updateLeds(net: Network, t: number): void {
    if (this.statusCache.version !== net.state.version) {
      const status = new Map<string, string>();
      for (const ref of this.ledRefs) {
        if (ref.startsWith('syst:')) {
          const sw = net.state.switches[ref.slice(5)];
          status.set(ref, sw?.rebooting ? 'boot' : 'ok');
          continue;
        }
        const [d, p] = splitRef(ref);
        if (net.state.switches[d]) {
          const sw = net.state.switches[d];
          status.set(ref, sw.rebooting ? 'boot' : net.portStatus(d, p));
        } else status.set(ref, net.link(ref).up ? 'connected' : 'notconnect');
      }
      this.statusCache = { version: net.state.version, status };
    }
    this.ledRefs.forEach((ref, i) => {
      const st = this.statusCache.status.get(ref);
      // Clignotement pseudo-aléatoire propre à chaque port (activité réseau).
      const flicker = Math.sin(t * (9 + (i % 7) * 2.3) + i * 1.7) > 0.35;
      switch (st) {
        case 'ok':
          this.ledColor.setHex(0x22ff55);
          break;
        case 'connected':
          this.ledColor.setHex(flicker ? 0x22ff55 : 0x0b5a1c);
          break;
        case 'boot':
          this.ledColor.setHex(Math.sin(t * 6) > 0 ? 0xffa000 : 0x3a2400);
          break;
        case 'err-disabled':
          this.ledColor.setHex(0xff8c00);
          break;
        case 'inactive':
          this.ledColor.setHex(Math.sin(t * 3 + i) > 0 ? 0xff8c00 : 0x2a1800);
          break;
        default:
          this.ledColor.setHex(0x151515);
      }
      this.leds.setColorAt(i, this.ledColor);
    });
    if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
  }
}

/** Courbe d'un cordon : sort du port, pend selon sa longueur, rentre dans l'autre port. */
function cableGeometry(a: THREE.Vector3, b: THREE.Vector3, length: number): THREE.BufferGeometry {
  const dist = a.distanceTo(b);
  const slack = Math.max(0, length - dist);
  const out = 0.025 + Math.min(0.08, slack * 0.05);
  const sag = Math.min(0.22, 0.015 + slack * 0.12);
  const mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, -sag, out + 0.015));
  const curve = new THREE.CatmullRomCurve3([
    a.clone(),
    a.clone().add(new THREE.Vector3(0, -0.004, 0.018)),
    a.clone().add(new THREE.Vector3(0, -0.012, out)),
    mid,
    b.clone().add(new THREE.Vector3(0, -0.012, out)),
    b.clone().add(new THREE.Vector3(0, -0.004, 0.018)),
    b.clone(),
  ]);
  const tube = new THREE.TubeGeometry(curve, 36, 0.0024, 5);
  // Fiches RJ45 (manchons) aux deux bouts
  const boots = [a, b].map((p) => {
    const g = new THREE.BoxGeometry(0.011, 0.009, 0.02);
    g.translate(p.x, p.y, p.z + 0.008);
    return g;
  });
  const merged = mergeGeometries([tube.toNonIndexed(), ...boots.map((g) => g.toNonIndexed())]);
  tube.dispose();
  boots.forEach((g) => g.dispose());
  return merged;
}

function upsTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1f2326';
  ctx.fillRect(0, 0, 1024, 384);
  ctx.fillStyle = '#555b62';
  ctx.fillRect(0, 0, 36, 384);
  ctx.fillRect(988, 0, 36, 384);
  ctx.fillStyle = '#c8d0d8';
  ctx.font = 'bold 26px Arial';
  ctx.fillText('ONDULEUR 3000VA', 52, 60);
  ctx.fillStyle = '#7ec8a0';
  ctx.fillRect(420, 120, 220, 110);
  ctx.fillStyle = '#123';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('SECTEUR', 440, 165);
  ctx.fillText('BAT 100%', 440, 210);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
