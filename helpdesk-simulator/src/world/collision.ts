/**
 * Collisions 2D (plan XZ) très simples : le joueur est un cercle,
 * les murs / meubles sont des boîtes alignées sur les axes (AABB).
 * Module pur, sans Three.js, donc testable avec Vitest.
 */

export interface AABB2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Une boîte désactivée (porte ouverte…) est ignorée. */
  enabled?: boolean;
}

export function makeBox(cx: number, cz: number, sx: number, sz: number): AABB2 {
  return { minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 };
}

/** Repousse un cercle hors de toutes les boîtes qu'il chevauche. */
export function resolveCircle(x: number, z: number, r: number, boxes: readonly AABB2[]): { x: number; z: number } {
  // Plusieurs passes pour gérer les coins (deux boîtes qui se touchent).
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const b of boxes) {
      if (b.enabled === false) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      moved = true;
      if (d2 > 1e-10) {
        // Le centre est dehors : on pousse le long de la normale au point le plus proche.
        const d = Math.sqrt(d2);
        x += (dx / d) * (r - d);
        z += (dz / d) * (r - d);
      } else {
        // Le centre est dans la boîte : on sort par le côté le plus proche.
        const left = x - b.minX + r;
        const right = b.maxX - x + r;
        const top = z - b.minZ + r;
        const bottom = b.maxZ - z + r;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x -= left;
        else if (m === right) x += right;
        else if (m === top) z -= top;
        else z += bottom;
      }
    }
    if (!moved) break;
  }
  return { x, z };
}

/**
 * Déplace un cercle de (dx, dz) en sous-pas courts pour ne jamais traverser
 * un mur fin, même si l'image a duré longtemps.
 */
export function moveCircle(
  x: number,
  z: number,
  dx: number,
  dz: number,
  r: number,
  boxes: readonly AABB2[],
): { x: number; z: number } {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.05));
  let p = { x, z };
  for (let i = 0; i < steps; i++) {
    p = resolveCircle(p.x + dx / steps, p.z + dz / steps, r, boxes);
  }
  return p;
}
