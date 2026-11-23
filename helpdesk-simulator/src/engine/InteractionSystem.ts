/**
 * Raycast depuis le centre de l'écran : trouve l'objet interactif regardé
 * (à moins de 2 m), le surligne et fournit le texte de la bulle « E — … ».
 */
import * as THREE from 'three';

export interface Interactable {
  id: string;
  object: THREE.Object3D;
  /** Texte de l'action (null = rien à faire pour l'instant). */
  label: () => string | null;
  onInteract: () => void;
  maxDistance?: number;
}

const HIGHLIGHT = new THREE.Color(0x3a78c2);

interface Highlighted {
  materials: { m: THREE.MeshLambertMaterial; emissive: THREE.Color; intensity: number }[];
}

export class InteractionSystem {
  private items = new Map<string, Interactable>();
  private targets: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private center = new THREE.Vector2(0, 0);
  private current: Interactable | null = null;
  private highlighted = new Map<string, Highlighted>();
  /** Objets qui bloquent le regard (murs, plateaux…). */
  occluders: THREE.Object3D[] = [];

  register(item: Interactable): Interactable {
    item.object.userData.interactableId = item.id;
    // Matériaux propres à l'objet : le surlignage ne déteint pas sur les autres.
    item.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
        mesh.material = (mesh.material as THREE.Material).clone();
      }
    });
    this.items.set(item.id, item);
    this.targets.push(item.object);
    return item;
  }

  get(id: string): Interactable | undefined {
    return this.items.get(id);
  }

  get hovered(): Interactable | null {
    return this.current;
  }

  /** Raycast + surlignage. `enabled = false` efface la sélection. */
  update(camera: THREE.Camera, enabled: boolean): Interactable | null {
    let found: Interactable | null = null;
    if (enabled) {
      this.raycaster.setFromCamera(this.center, camera);
      this.raycaster.far = 2.5;
      const hits = this.raycaster.intersectObjects([...this.targets, ...this.occluders], true);
      for (const hit of hits) {
        const item = this.findItem(hit.object);
        if (!item) break; // un mur est devant
        if (hit.distance <= (item.maxDistance ?? 2)) found = item;
        break;
      }
      if (found && !found.label()) found = null;
    }
    if (found !== this.current) {
      if (this.current) this.setHighlight(this.current, false);
      if (found) this.setHighlight(found, true);
      this.current = found;
    }
    return found;
  }

  private findItem(o: THREE.Object3D | null): Interactable | null {
    while (o) {
      const id = o.userData.interactableId as string | undefined;
      if (id) return this.items.get(id) ?? null;
      o = o.parent;
    }
    return null;
  }

  private setHighlight(item: Interactable, on: boolean): void {
    if (on) {
      const h: Highlighted = { materials: [] };
      item.object.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
        if ((o as THREE.Mesh).isMesh && m?.isMeshLambertMaterial) {
          h.materials.push({ m, emissive: m.emissive.clone(), intensity: m.emissiveIntensity });
          m.emissive.copy(HIGHLIGHT);
          m.emissiveIntensity = 0.45;
        }
      });
      this.highlighted.set(item.id, h);
    } else {
      const h = this.highlighted.get(item.id);
      h?.materials.forEach(({ m, emissive, intensity }) => {
        m.emissive.copy(emissive);
        m.emissiveIntensity = intensity;
      });
      this.highlighted.delete(item.id);
    }
  }

  clear(): void {
    if (this.current) this.setHighlight(this.current, false);
    this.current = null;
  }
}
