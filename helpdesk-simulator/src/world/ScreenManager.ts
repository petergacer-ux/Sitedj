/**
 * Les écrans des PC du décor sont des CanvasTexture redessinées quand l'état change
 * (et une fois par minute de jeu pour l'horloge de l'écran de verrouillage).
 * Cela permet de VOIR certains problèmes en regardant (écran noir, erreur…).
 */
import * as THREE from 'three';
import { formatTime } from '../state/clock';

export type NetIcon = 'ok' | 'limited' | 'none';

export type ScreenState = 'lock' | 'desktop' | 'off' | 'error' | 'helpdesk' | 'tv' | 'nosignal' | 'boot';

export interface Screen {
  id: string;
  state: ScreenState;
  pcName: string;
  userName: string;
  message?: string;
  /** Icône réseau de la barre des tâches : ok, accès limité (APIPA), aucun réseau. */
  net: NetIcon;
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
    const screen: Screen = { id, state, pcName, userName, net: 'ok', canvas, texture, material };
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

  /** Met à jour l'icône réseau (redessine seulement si elle change). */
  setNet(id: string, net: NetIcon): void {
    const s = this.screens.get(id);
    if (!s || s.net === net) return;
    s.net = net;
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
      case 'boot': {
        ctx.fillStyle = '#0b3d91';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⊞', W / 2, H / 2 - 10);
        ctx.font = '14px "Segoe UI", Arial';
        ctx.fillText('Redémarrage…', W / 2, H / 2 + 30);
        break;
      }
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
        ctx.fillText(s.userName ? `${s.userName}` : 'Ctrl+Alt+Suppr pour ouvrir', 22, H - 26);
        if (s.message) {
          ctx.fillStyle = '#c62828';
          ctx.fillRect(14, 30, W - 28, 30);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px Arial';
          ctx.fillText(s.message, 22, 50);
        }
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
        drawNetIcon(ctx, W - 52, H - 9, s.net);
        if (s.net !== 'ok') {
          // Bulle de notification Windows, visible de loin
          ctx.fillStyle = '#2b2b2b';
          ctx.fillRect(W - 170, H - 62, 162, 40);
          ctx.fillStyle = s.net === 'none' ? '#ff6b6b' : '#ffd24d';
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(s.net === 'none' ? 'Câble réseau débranché' : 'Pas d’accès Internet', W - 162, H - 46);
          ctx.fillStyle = '#ddd';
          ctx.font = '10px Arial';
          ctx.fillText(s.net === 'none' ? 'Aucune connexion' : 'Réseau non identifié', W - 162, H - 31);
        }
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

/** Icône réseau de la barre des tâches (écran + câble / triangle / croix). */
function drawNetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, net: NetIcon): void {
  ctx.fillStyle = '#e8eef5';
  ctx.fillRect(x - 6, y - 5, 12, 8);
  ctx.fillRect(x - 2, y + 3, 4, 2);
  if (net === 'limited') {
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 7);
    ctx.lineTo(x + 12, y + 4);
    ctx.lineTo(x, y + 4);
    ctx.closePath();
    ctx.fill();
  } else if (net === 'none') {
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(x + 6, y + 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 8, y + 4);
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + 4, y + 4);
    ctx.stroke();
  }
}
