/**
 * Matériaux partagés (Lambert : léger et adapté au low poly).
 * Mis en cache par couleur pour limiter le nombre de matériaux.
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.MeshLambertMaterial>();

export function mat(color: number, opts: { emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}): THREE.MeshLambertMaterial {
  const key = `${color}|${opts.emissive ?? 0}|${opts.emissiveIntensity ?? 1}|${opts.opacity ?? 1}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: opts.transparent ?? (opts.opacity !== undefined && opts.opacity < 1),
      opacity: opts.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

/** Palette du décor. */
export const C = {
  wall: 0xe8e4dc,
  wallAccent: 0xd7dde3,
  ceiling: 0xf4f4f2,
  desk: 0xc9a77c,
  deskLeg: 0x5a5f66,
  chair: 0x30363d,
  chairSeat: 0x3d5a80,
  monitor: 0x1d1f22,
  pc: 0x2b2e33,
  keyboard: 0x24272b,
  metal: 0x8c939b,
  rack: 0x1a1c1f,
  door: 0x8b6b4a,
  doorFrame: 0x6b7280,
  glass: 0xbfe3ff,
  plantPot: 0x7a5236,
  plant: 0x3f7f3f,
  neon: 0xffffff,
  jack: 0xf2f2f2,
  cableBlue: 0x2d6cdf,
};
