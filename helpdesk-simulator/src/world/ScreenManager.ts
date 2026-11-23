/**
 * Les écrans des PC du décor sont des CanvasTexture redessinées quand l'état change
 * (et une fois par minute de jeu pour l'horloge de l'écran de verrouillage).
 * Cela permet de VOIR certains problèmes en regardant (écran noir, erreur…).
 */
import * as THREE from 'three';
import { formatTime } from '../state/clock';

export type ScreenState = 'lock' | 'desktop' | 'off' | 'error' | 'helpdesk' | 'tv' | 'nosignal';

export interface Screen {
  id: string;
  state: ScreenState;
  pcName: string;
  userName: string;
  message?: string;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
}

const W = 320;
const H = 192;

export class ScreenManager {
  private screens = new Map<string, Screen>();
  private minutes = 510;

  create(id: string, pcName: string, userName: string, state: ScreenState): Screen {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const screen: Screen = { id, state, pcName, userName, canvas, texture, material };
    this.screens.set(id, screen);
    this.draw(screen);
    return screen;
  }

  get(id: string): Screen | undefined {
    return this.screens.get(id);
  }

  setState(id: string, state: ScreenState, message?: string): void {
    const s = this.screens.get(id);
    if (!s) return;
    s.state = state;
    s.message = message;
    this.draw(s);
  }

  /** Appelé à chaque minute de jeu. */
  tick(minutes: number): void {
    this.minutes = minutes;
    this.screens.forEach((s) => {
      if (s.state === 'lock' || s.state === 'desktop' || s.state === 'helpdesk') this.draw(s);
    });
  }

  private draw(s: Screen): void {
    const ctx = s.canvas.getContext('2d')!;
    const time = formatTime(this.minutes);
    ctx.textBaseline = 'alphabetic';
    switch (s.state) {
      case 'off':
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, W, H);
        break;
      case 'nosignal':
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#2b57d9';
        ctx.fillRect(W / 2 - 80, H / 2 - 18, 160, 36);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Aucun signal', W / 2, H / 2 + 5);
        break;
      case 'lock': {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#0b3d91');
        g.addColorStop(1, '#3a7bd5');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.font = '300 46px "Segoe UI", Arial';
        ctx.fillText(time, 20, H - 50);
        ctx.font = '15px "Segoe UI", Arial';
        ctx.fillText(s.userName ? `${s.userName} — verrouillé` : 'Ctrl+Alt+Suppr pour ouvrir', 22, H - 26);
        ctx.font = '11px Arial';
        ctx.globalAlpha = 0.7;
        ctx.fillText(s.pcName, 22, 20);
        ctx.globalAlpha = 1;
        break;
      }
      case 'desktop': {
        ctx.fillStyle = '#1e6fb8';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e8eef5';
        for (let i = 0; i < 4; i++) ctx.fillRect(10, 10 + i * 34, 22, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(70, 30, 200, 110);
        ctx.fillStyle = '#2b579a';
        ctx.fillRect(70, 30, 200, 14);
        ctx.fillStyle = '#c8c8c8';
        for (let i = 0; i < 6; i++) ctx.fillRect(80, 54 + i * 13, 120 + ((i * 37) % 60), 6);
        ctx.fillStyle = '#20262e';
        ctx.fillRect(0, H - 18, W, 18);
        ctx.fillStyle = '#fff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(time, W - 8, H - 5);
        break;
      }
      case 'error': {
        ctx.fillStyle = '#1e6fb8';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(40, 45, 240, 100);
        ctx.fillStyle = '#c42b1c';
        ctx.beginPath();
        ctx.arc(70, 90, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('×', 70, 96);
        ctx.fillStyle = '#111';
        ctx.font = '12px "Segoe UI", Arial';
        ctx.textAlign = 'left';
        const msg = s.message ?? 'Erreur inconnue';
        wrap(ctx, msg, 95, 80, 175, 14);
        break;
      }
      case 'helpdesk': {
        ctx.fillStyle = '#f3f5f8';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#243447';
        ctx.fillRect(0, 0, 60, H);
        ctx.fillStyle = '#2f6fdf';
        ctx.fillRect(60, 0, W - 60, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('HelpDesk Pro', 68, 14);
        ctx.textAlign = 'right';
        ctx.fillText(time, W - 6, 14);
        ctx.fillStyle = '#d5dbe3';
        for (let i = 0; i < 8; i++) ctx.fillRect(68, 30 + i * 19, W - 80, 14);
        ctx.fillStyle = '#7f93ab';
        for (let i = 0; i < 6; i++) ctx.fillRect(8, 30 + i * 22, 44, 10);
        break;
      }
      case 'tv': {
        ctx.fillStyle = '#101820';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#4fc3f7';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Salle de réunion', W / 2, H / 2 - 6);
        ctx.fillStyle = '#9fb3c8';
        ctx.font = '13px Arial';
        ctx.fillText(s.message ?? 'Aucune visio en cours', W / 2, H / 2 + 18);
        break;
      }
    }
    s.texture.needsUpdate = true;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}
