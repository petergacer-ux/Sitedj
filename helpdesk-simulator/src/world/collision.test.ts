import { describe, expect, it } from 'vitest';
import { makeBox, moveCircle, resolveCircle } from './collision';

describe('collisions', () => {
  const wall = makeBox(0, 0, 10, 0.15); // mur horizontal centré en z=0

  it('ne touche pas un cercle éloigné', () => {
    expect(resolveCircle(0, 2, 0.3, [wall])).toEqual({ x: 0, z: 2 });
  });

  it('repousse un cercle qui chevauche un mur', () => {
    const p = resolveCircle(0, 0.2, 0.3, [wall]);
    expect(p.z).toBeCloseTo(0.075 + 0.3);
  });

  it('empêche de traverser un mur fin même avec un grand pas', () => {
    const p = moveCircle(0, 1, 0, -3, 0.3, [wall]);
    expect(p.z).toBeGreaterThan(0.3);
  });

  it('glisse le long du mur', () => {
    const p = moveCircle(0, 0.5, 1, -1, 0.3, [wall]);
    expect(p.x).toBeCloseTo(1, 1);
    expect(p.z).toBeCloseTo(0.375, 2);
  });

  it('ignore les boîtes désactivées (porte ouverte)', () => {
    const door = { ...makeBox(0, 0, 1, 0.15), enabled: false };
    const p = moveCircle(0, 1, 0, -2, 0.3, [door]);
    expect(p.z).toBeCloseTo(-1);
  });
});
