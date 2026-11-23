/**
 * Remplacement optionnel des objets low poly par de vrais modèles 3D (GLTF/GLB).
 * Dépose un fichier dans public/assets/models/ et déclare-le dans manifest.json :
 *   { "models": { "coffee": "machine_cafe.glb" } }
 * Le modèle est automatiquement mis à l'échelle de l'objet qu'il remplace.
 * L'objet d'origine reste présent (invisible) pour le raycast et les interactions.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Manifest {
  models: Record<string, string>;
}

export class ModelLoader {
  private placeholders = new Map<string, THREE.Object3D[]>();
  private loader = new GLTFLoader();
  private base = `${import.meta.env.BASE_URL}assets/models/`;

  /** Déclare un objet remplaçable sous une clé (ex. « monitor »). */
  register(key: string, obj: THREE.Object3D): void {
    let list = this.placeholders.get(key);
    if (!list) this.placeholders.set(key, (list = []));
    list.push(obj);
  }

  async loadAll(): Promise<void> {
    let manifest: Manifest;
    try {
      const res = await fetch(`${this.base}manifest.json`);
      if (!res.ok) return;
      manifest = (await res.json()) as Manifest;
    } catch {
      return;
    }
    for (const [key, file] of Object.entries(manifest.models ?? {})) {
      const targets = this.placeholders.get(key);
      if (!targets?.length) continue;
      try {
        const gltf = await this.loader.loadAsync(this.base + file);
        for (const target of targets) this.replace(target, gltf.scene);
        console.info(`[modèles] ${key} ← ${file} (${targets.length} objet(s))`);
      } catch (e) {
        console.warn(`[modèles] impossible de charger ${file}`, e);
      }
    }
  }

  private replace(target: THREE.Object3D, source: THREE.Object3D): void {
    target.updateMatrixWorld(true);
    // Boîte englobante de l'objet d'origine, dans son propre repère.
    const inv = new THREE.Matrix4().copy(target.matrixWorld).invert();
    const box = new THREE.Box3();
    target.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.geometry.computeBoundingBox();
        const b = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
        box.union(b);
        mesh.visible = false;
      }
    });
    const model = source.clone(true);
    const mb = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const msize = mb.getSize(new THREE.Vector3());
    const s = Math.min(size.x / msize.x, size.y / msize.y, size.z / msize.z);
    model.scale.setScalar(s);
    const center = box.getCenter(new THREE.Vector3());
    const mcenter = mb.getCenter(new THREE.Vector3()).multiplyScalar(s);
    model.position.set(center.x - mcenter.x, box.min.y - mb.min.y * s, center.z - mcenter.z);
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    target.add(model);
  }
}
