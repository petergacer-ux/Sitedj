/**
 * Regroupe tous les objets statiques en boîtes dans des InstancedMesh
 * (une seule géométrie, un draw call par matériau) : indispensable pour
 * tenir 60 FPS avec des centaines de pieds de bureau, néons, chaises…
 */
import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);

export class StaticBatcher {
  private groups = new Map<THREE.Material, THREE.Matrix4[]>();

  /**
   * Ajoute une boîte.
   * @param size [sx, sy, sz] en mètres
   * @param pos centre [x, y, z] dans le repère `frame` (ou le monde)
   * @param frame matrice optionnelle (repère local d'un meuble)
   */
  box(material: THREE.Material, size: [number, number, number], pos: [number, number, number], frame?: THREE.Matrix4, rotY = 0): void {
    tmpPos.set(pos[0], pos[1], pos[2]);
    tmpQuat.setFromAxisAngle(yAxis, rotY);
    tmpScale.set(size[0], size[1], size[2]);
    const m = new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale);
    if (frame) m.premultiply(frame);
    let list = this.groups.get(material);
    if (!list) this.groups.set(material, (list = []));
    list.push(m);
  }

  get count(): number {
    let n = 0;
    this.groups.forEach((l) => (n += l.length));
    return n;
  }

  build(name: string, castShadow: boolean, receiveShadow: boolean): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    this.groups.forEach((matrices, material) => {
      const mesh = new THREE.InstancedMesh(unitBox, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.computeBoundingSphere();
      group.add(mesh);
    });
    return group;
  }
}

/** Repère local d'un meuble : position + rotation autour de Y. */
export function frameAt(x: number, z: number, rotY: number, y = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(yAxis, rotY), new THREE.Vector3(1, 1, 1));
}
