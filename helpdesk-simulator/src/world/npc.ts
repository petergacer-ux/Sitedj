/** Personnage low poly assis à son bureau (PNJ). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { UserDef } from '../data/users';
import { mat } from './materials';

export interface NpcBuild {
  group: THREE.Group;
  head: THREE.Object3D;
  phase: number;
}

function part(size: [number, number, number], color: number, pos: [number, number, number]): THREE.Mesh {
  // Matériau cloné : chaque PNJ peut être surligné indépendamment.
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color).clone());
  m.position.set(...pos);
  m.castShadow = true;
  return m;
}

/**
 * Construit un PNJ assis, dans le repère local d'un bureau
 * (bureau vers -z, chaise en z ≈ 0,62).
 */
export function buildSeatedNpc(user: UserDef): NpcBuild {
  const g = new THREE.Group();
  g.name = `npc:${user.id}`;
  const pants = 0x2f3640;
  const z = 0.62;
  // Jambes
  g.add(part([0.36, 0.13, 0.42], pants, [0, 0.56, z - 0.18]));
  g.add(part([0.34, 0.48, 0.12], pants, [0, 0.27, z - 0.38]));
  g.add(part([0.36, 0.06, 0.2], 0x1a1a1a, [0, 0.03, z - 0.44]));
  // Buste
  g.add(part([0.42, 0.55, 0.24], user.shirt, [0, 0.9, z + 0.05]));
  // Bras (vers le clavier)
  for (const sx of [-0.26, 0.26]) {
    g.add(part([0.1, 0.32, 0.11], user.shirt, [sx, 0.98, z + 0.02]));
    g.add(part([0.09, 0.09, 0.36], user.shirt, [sx * 0.85, 0.8, z - 0.15]));
    g.add(part([0.08, 0.06, 0.08], user.skin, [sx * 0.7, 0.79, z - 0.36]));
  }
  // Tête
  const head = new THREE.Group();
  head.position.set(0, 1.2, z + 0.04);
  head.add(part([0.1, 0.08, 0.1], user.skin, [0, 0, 0]));
  head.add(part([0.24, 0.27, 0.24], user.skin, [0, 0.17, 0]));
  head.add(part([0.26, 0.09, 0.26], user.hair, [0, 0.32, 0.01]));
  head.add(part([0.26, 0.18, 0.06], user.hair, [0, 0.22, 0.12]));
  mergeByColor(head);
  mergeByColor(g);
  g.add(head);
  return { group: g, head, phase: Math.random() * 10 };
}

/**
 * Fusionne les boîtes d'un même groupe par couleur : un PNJ passe
 * d'une vingtaine de draw calls à 4 ou 5.
 */
function mergeByColor(group: THREE.Group): void {
  const byColor = new Map<number, THREE.BufferGeometry[]>();
  const meshes = group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
  for (const m of meshes) {
    const color = (m.material as THREE.MeshLambertMaterial).color.getHex();
    m.updateMatrix();
    const geo = m.geometry.clone().applyMatrix4(m.matrix);
    let list = byColor.get(color);
    if (!list) byColor.set(color, (list = []));
    list.push(geo);
    group.remove(m);
  }
  byColor.forEach((geos, color) => {
    const merged = new THREE.Mesh(mergeGeometries(geos), mat(color).clone());
    merged.castShadow = true;
    group.add(merged);
  });
}

/** Petite animation d'attente (la tête bouge un peu). */
export function animateNpc(npc: NpcBuild, t: number): void {
  npc.head.rotation.y = Math.sin(t * 0.4 + npc.phase) * 0.25 + Math.sin(t * 1.3 + npc.phase) * 0.05;
  npc.head.rotation.x = Math.sin(t * 0.25 + npc.phase * 2) * 0.08 + 0.1;
}

/** PNJ debout (visite au helpdesk, chef de service…). Face vers -z local. */
export function buildStandingNpc(look: { shirt: number; skin: number; hair: number; pants?: number }, name: string): NpcBuild {
  const g = new THREE.Group();
  g.name = name;
  const pants = look.pants ?? 0x2f3640;
  for (const sx of [-0.1, 0.1]) {
    g.add(part([0.13, 0.8, 0.15], pants, [sx, 0.4, 0]));
    g.add(part([0.14, 0.06, 0.24], 0x1a1a1a, [sx, 0.03, -0.04]));
  }
  g.add(part([0.42, 0.6, 0.24], look.shirt, [0, 1.1, 0]));
  for (const sx of [-0.27, 0.27]) {
    g.add(part([0.1, 0.55, 0.11], look.shirt, [sx, 1.08, 0]));
    g.add(part([0.08, 0.08, 0.08], look.skin, [sx, 0.77, 0]));
  }
  const head = new THREE.Group();
  head.position.set(0, 1.45, 0);
  head.add(part([0.1, 0.08, 0.1], look.skin, [0, 0, 0]));
  head.add(part([0.24, 0.27, 0.24], look.skin, [0, 0.17, 0]));
  head.add(part([0.26, 0.09, 0.26], look.hair, [0, 0.32, 0.01]));
  head.add(part([0.26, 0.18, 0.06], look.hair, [0, 0.22, 0.12]));
  mergeByColor(head);
  mergeByColor(g);
  g.add(head);
  // Bulle « ! » au-dessus de la tête (visible quand il attend quelque chose)
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc107 }));
  bubble.position.set(0, 2.05, 0);
  bubble.name = 'bubble';
  g.add(bubble);
  return { group: g, head, phase: Math.random() * 10 };
}
