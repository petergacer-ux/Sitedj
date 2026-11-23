/** Renderer Three.js, lumières et réglages de qualité graphique. */
import * as THREE from 'three';
import type { Quality } from '../state/settings';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  private quality: Quality;

  constructor(container: HTMLElement, quality: Quality, fov: number) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 80);
    this.scene.background = new THREE.Color(0xbfd9ef);
    this.scene.fog = new THREE.Fog(0xdfe6ec, 25, 60);

    // Éclairage doux de bureau : lumière d'ambiance (néons) + soleil par les fenêtres sud.
    const hemi = new THREE.HemisphereLight(0xffffff, 0x9a9488, 1.6);
    this.scene.add(hemi);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.4);
    this.sun.position.set(14, 18, 40);
    this.sun.target.position.set(20, 0, 12);
    this.scene.add(this.sun, this.sun.target);
    const cam = this.sun.shadow.camera;
    cam.left = -26;
    cam.right = 26;
    cam.top = 20;
    cam.bottom = -20;
    cam.near = 1;
    cam.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;

    this.applyQuality(quality);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** Basse : pas d'ombres, résolution réduite. Moyenne : ombres 1024. Haute : ombres 2048, pleine résolution. */
  applyQuality(q: Quality): void {
    const changedShadows = (q === 'low') !== (this.quality === 'low') || !this.renderer.shadowMap.enabled !== (q === 'low');
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 1) * 0.75 : q === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 2));
    const shadows = q !== 'low';
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (changedShadows) {
      // Les shaders doivent être recompilés quand on active/désactive les ombres.
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
        else if (m) m.needsUpdate = true;
      });
    }
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
