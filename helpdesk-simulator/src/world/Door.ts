/** Porte battante animée, avec boîte de collision quand elle est fermée. */
import * as THREE from 'three';
import type { DoorDef } from '../data/map';
import { WALL_T } from '../data/map';
import type { AABB2 } from './collision';
import { C, mat } from './materials';

export class Door {
  readonly def: DoorDef;
  readonly pivot = new THREE.Group();
  readonly panel: THREE.Mesh;
  readonly collider: AABB2;
  isOpen = false;
  locked: boolean;
  private angle = 0;

  constructor(def: DoorDef) {
    this.def = def;
    this.locked = !!def.locked;
    const h = 2.1;
    const w = def.width - 0.04;
    // Charnière à gauche de l'ouverture (x minimum).
    this.pivot.position.set(def.x - def.width / 2 + 0.02, 0, def.z);
    this.panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mat(C.door).clone());
    this.panel.position.set(w / 2, h / 2, 0);
    this.panel.castShadow = true;
    // Poignée
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), mat(C.metal));
    handle.position.set(w / 2 - 0.08, -0.05, 0);
    this.panel.add(handle);
    this.pivot.add(this.panel);
    this.collider = {
      minX: def.x - def.width / 2,
      maxX: def.x + def.width / 2,
      minZ: def.z - WALL_T / 2,
      maxZ: def.z + WALL_T / 2,
      enabled: true,
    };
  }

  setOpen(open: boolean): void {
    this.isOpen = open;
    this.collider.enabled = !open;
  }

  update(dt: number): void {
    const target = this.isOpen ? (Math.PI / 2) * 0.95 : 0;
    this.angle += (target - this.angle) * Math.min(1, dt * 6);
    this.pivot.rotation.y = this.angle * this.def.openDir;
  }
}
