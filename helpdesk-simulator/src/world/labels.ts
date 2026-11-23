/** Textes affichés dans le décor (panneaux, étiquettes de prises), via CanvasTexture. */
import * as THREE from 'three';

export interface LabelOpts {
  bg?: string;
  fg?: string;
  font?: string;
  px?: number; // pixels par mètre
  border?: string;
}

export function makeTextTexture(text: string, wPx: number, hPx: number, opts: LabelOpts = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = opts.bg ?? '#ffffff';
  ctx.fillRect(0, 0, wPx, hPx);
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = Math.max(2, hPx * 0.06);
    ctx.strokeRect(0, 0, wPx, hPx);
  }
  ctx.fillStyle = opts.fg ?? '#111111';
  ctx.font = opts.font ?? `bold ${Math.floor(hPx * 0.55)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, wPx / 2, hPx / 2 + hPx * 0.03);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Plan texturé d'une taille donnée en mètres. */
export function makeLabel(text: string, w: number, h: number, opts: LabelOpts = {}): THREE.Mesh {
  const px = opts.px ?? 256;
  const tex = makeTextTexture(text, Math.ceil(w * px), Math.ceil(h * px), opts);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.name = `label:${text}`;
  return mesh;
}
