/** Objet tenu en main, affiché en bas à droite de la vue (comme une arme dans un FPS). */
import * as THREE from 'three';
import { ITEMS } from '../sim/items';
import type { ItemId } from '../sim/types';
import { mat } from './materials';

function boxM(size: [number, number, number], color: number, pos: [number, number, number] = [0, 0, 0], basic = false): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), basic ? new THREE.MeshBasicMaterial({ color }) : mat(color));
  m.position.set(...pos);
  return m;
}

function model(id: ItemId): THREE.Object3D {
  const g = new THREE.Group();
  const c = ITEMS[id].color;
  switch (id) {
    case 'tester':
      g.add(boxM([0.08, 0.14, 0.03], c), boxM([0.06, 0.04, 0.005], 0x9be7a0, [0, 0.03, 0.017], true), boxM([0.02, 0.02, 0.02], 0x222222, [0, -0.08, 0]));
      break;
    case 'rj45':
    case 'patch':
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 18), mat(c));
        t.position.set(0, 0, i * 0.01);
        g.add(t);
      }
      g.add(boxM([0.02, 0.016, 0.03], 0xdddddd, [0.05, -0.02, 0.02]));
      break;
    case 'screwdriver':
      g.add(boxM([0.03, 0.09, 0.03], c, [0, -0.03, 0]), boxM([0.008, 0.12, 0.008], 0xb0b0b0, [0, 0.07, 0]));
      g.rotation.z = -0.6;
      break;
    case 'ram':
      g.add(boxM([0.13, 0.03, 0.004], c), boxM([0.11, 0.015, 0.006], 0x222222, [0, 0, 0.003]));
      break;
    case 'monitor':
      g.add(boxM([0.22, 0.14, 0.02], c), boxM([0.2, 0.12, 0.002], 0x334455, [0, 0, 0.011], true));
      break;
    case 'laptop':
      g.add(boxM([0.2, 0.012, 0.14], c), boxM([0.2, 0.13, 0.01], c, [0, 0.065, -0.07]));
      break;
    case 'toner':
    case 'cartridge':
      g.add(boxM([0.16, 0.05, 0.05], c), boxM([0.04, 0.052, 0.052], 0xf39c12, [0.06, 0, 0]));
      break;
    case 'keyboard':
      g.add(boxM([0.2, 0.015, 0.07], c));
      break;
    case 'mouse':
      g.add(boxM([0.035, 0.02, 0.06], c));
      break;
    default:
      g.add(boxM([0.08, 0.06, 0.08], c));
  }
  return g;
}

export class HeldItem {
  readonly group = new THREE.Group();
  private current: ItemId | null = null;
  private bob = 0;

  constructor(camera: THREE.Camera) {
    this.group.position.set(0.22, -0.2, -0.42);
    camera.add(this.group);
  }

  set(id: ItemId | null): void {
    if (id === this.current) return;
    this.current = id;
    this.group.clear();
    if (id) {
      const m = model(id);
      m.rotation.y += -0.5;
      m.rotation.x += 0.25;
      this.group.add(m);
      this.group.position.y = -0.35; // petite animation de sortie
    }
  }

  update(dt: number, moving: boolean, visible: boolean): void {
    this.group.visible = visible && !!this.current;
    this.bob += dt * (moving ? 9 : 2);
    const targetY = -0.2 + Math.sin(this.bob) * (moving ? 0.008 : 0.003);
    this.group.position.y += (targetY - this.group.position.y) * Math.min(1, dt * 10);
  }
}
