/**
 * Contrôles à la première personne :
 * - PointerLockControls pour le regard à la souris,
 * - ZQSD / WASD (touches physiques : fonctionne en AZERTY comme en QWERTY),
 * - Maj pour accélérer, C (ou Ctrl) pour se baisser,
 * - collisions cercle / boîtes, balancement de la caméra,
 * - animation « s'approcher d'un écran » puis retour.
 */
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { moveCircle, type AABB2 } from '../world/collision';

const STAND_EYE = 1.65;
const CROUCH_EYE = 0.6;
const RADIUS = 0.28;
const WALK = 2.6;
const RUN = 4.6;
const CROUCH_SPEED = 1.1;

interface Tween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  toQuat: THREE.Quaternion;
  t: number;
  duration: number;
  resolve: () => void;
}

export class FirstPersonController {
  readonly controls: PointerLockControls;
  readonly camera: THREE.PerspectiveCamera;
  /** Position des pieds (x, z) du joueur. */
  x = 0;
  z = 0;
  crouching = false;
  headBob = true;
  speedMultiplier = 1;
  private eye = STAND_EYE;
  private keys = new Set<string>();
  private bobPhase = 0;
  private bobAmount = 0;
  private tween: Tween | null = null;
  private savedPose: { pos: THREE.Vector3; quat: THREE.Quaternion } | null = null;
  /** true pendant une vue rapprochée (écran, baie) : le joueur ne bouge plus. */
  focused = false;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, dom);
    // On évite de regarder exactement à la verticale.
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI - 0.05;
    document.addEventListener('keydown', (e) => this.onKey(e, true));
    document.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseKeys());
  }

  set sensitivity(v: number) {
    this.controls.pointerSpeed = v;
  }

  get isLocked(): boolean {
    return this.controls.isLocked;
  }

  releaseKeys(): void {
    this.keys.clear();
    this.crouching = false;
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    // event.code = position physique : KeyW est « Z » sur un clavier AZERTY.
    const movementCodes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
    if (movementCodes.includes(e.code)) {
      if (down) this.keys.add(e.code);
      else this.keys.delete(e.code);
    }
    if (e.code === 'KeyC' || e.code === 'ControlLeft') {
      if (this.controls.isLocked) e.preventDefault();
      this.crouching = down;
    }
  }

  get yaw(): number {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    return e.y;
  }

  get pitch(): number {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    return e.x;
  }

  setPose(x: number, z: number, yaw: number, pitch = 0): void {
    this.x = x;
    this.z = z;
    this.camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    this.camera.position.set(x, this.eye, z);
  }

  /** Met à jour le déplacement (appelé seulement quand le joueur a le contrôle). */
  update(dt: number, colliders: readonly AABB2[]): void {
    if (this.tween) return;
    // Hauteur des yeux (se baisser en douceur)
    const targetEye = this.crouching ? CROUCH_EYE : STAND_EYE;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 10);

    let fwd = 0;
    let right = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;
    const moving = fwd !== 0 || right !== 0;
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = (this.crouching ? CROUCH_SPEED : running ? RUN : WALK) * this.speedMultiplier;

    if (moving) {
      const len = Math.hypot(fwd, right);
      const yaw = this.yaw;
      // Avant = -z dans le repère caméra.
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const dx = ((-sin * fwd + cos * right) / len) * speed * dt;
      const dz = ((-cos * fwd - sin * right) / len) * speed * dt;
      const p = moveCircle(this.x, this.z, dx, dz, RADIUS, colliders);
      this.x = p.x;
      this.z = p.z;
      this.bobPhase += dt * speed * 2.6;
    }
    this.bobAmount += ((moving && this.headBob ? 1 : 0) - this.bobAmount) * Math.min(1, dt * 8);
    const bob = Math.sin(this.bobPhase) * 0.035 * this.bobAmount;
    this.camera.position.set(this.x, this.eye + bob, this.z);
  }

  /** Anime la caméra vers une pose (vue rapprochée) puis résout la promesse. */
  focusOn(pos: THREE.Vector3, lookAt: THREE.Vector3, duration = 0.6): Promise<void> {
    if (!this.savedPose) this.savedPose = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() };
    this.focused = true;
    const m = new THREE.Matrix4().lookAt(pos, lookAt, new THREE.Vector3(0, 1, 0));
    const toQuat = new THREE.Quaternion().setFromRotationMatrix(m);
    return this.startTween(pos.clone(), toQuat, duration);
  }

  /** Revient à la pose d'avant la vue rapprochée. */
  async restore(duration = 0.45): Promise<void> {
    if (!this.savedPose) {
      this.focused = false;
      return;
    }
    const { pos, quat } = this.savedPose;
    this.savedPose = null;
    await this.startTween(pos, quat, duration);
    this.focused = false;
  }

  private startTween(toPos: THREE.Vector3, toQuat: THREE.Quaternion, duration: number): Promise<void> {
    this.tween?.resolve();
    return new Promise((resolve) => {
      this.tween = {
        fromPos: this.camera.position.clone(),
        toPos,
        fromQuat: this.camera.quaternion.clone(),
        toQuat,
        t: 0,
        duration: Math.max(0.01, duration),
        resolve,
      };
    });
  }

  /** Avance l'animation de caméra (appelé à chaque image). */
  updateTween(dt: number): void {
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    const k = tw.t * tw.t * (3 - 2 * tw.t); // smoothstep
    this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
    this.camera.quaternion.slerpQuaternions(tw.fromQuat, tw.toQuat, k);
    if (tw.t >= 1) {
      this.tween = null;
      tw.resolve();
    }
  }

  /** Déplace la caméra en vue rapprochée (molette dans la baie, par exemple). */
  nudgeFocus(dy: number, minY: number, maxY: number): void {
    if (this.tween) return;
    this.camera.position.y = Math.max(minY, Math.min(maxY, this.camera.position.y + dy));
  }
}
