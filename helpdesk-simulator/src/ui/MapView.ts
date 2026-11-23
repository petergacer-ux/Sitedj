/** Plan 2D de l'étage (touche M) : pièces, bureaux, position du joueur, tickets ouverts. */
import { DESKS, DOORS, FLOOR_D, FLOOR_W, MY_DESK, ROOMS, SPOTS, WALLS } from '../data/map';
import { getUser } from '../data/users';
import { el } from './dom';

export class MapView {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  isOpen = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', { class: 'mapview hidden' });
    this.canvas = el('canvas');
    const legend = el('div', { class: 'map-legend', html: '<span class="lg me">▲ Vous</span><span class="lg ticket">● Ticket ouvert</span><span class="lg desk">■ Poste</span><span class="lg">M ou Échap : fermer</span>' });
    this.root.append(el('div', { class: 'map-title' }, ['Plan de l’étage — 2e étage']), this.canvas, legend);
    parent.append(this.root);
  }

  toggle(): boolean {
    this.isOpen = !this.isOpen;
    this.root.classList.toggle('hidden', !this.isOpen);
    return this.isOpen;
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  draw(px: number, pz: number, yaw: number, ticketDesks: Set<string>, time: number): void {
    if (!this.isOpen) return;
    const maxW = Math.min(window.innerWidth * 0.86, 1100);
    const scale = Math.floor(Math.min(maxW / FLOOR_W, (window.innerHeight * 0.7) / FLOOR_D));
    const pad = 16;
    const W = FLOOR_W * scale + pad * 2;
    const H = FLOOR_D * scale + pad * 2;
    if (this.canvas.width !== W) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    const ctx = this.canvas.getContext('2d')!;
    const X = (x: number) => pad + x * scale;
    const Z = (z: number) => pad + z * scale;
    ctx.fillStyle = '#0f1822';
    ctx.fillRect(0, 0, W, H);

    // Pièces
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of ROOMS) {
      ctx.fillStyle = r.id === 'couloir' ? '#2a3542' : '#1d2a38';
      ctx.fillRect(X(r.x1), Z(r.z1), (r.x2 - r.x1) * scale, (r.z2 - r.z1) * scale);
      ctx.fillStyle = '#7f95ab';
      ctx.font = `${Math.max(10, scale * 0.42)}px Segoe UI, Arial`;
      ctx.fillText(r.name, X((r.x1 + r.x2) / 2), Z((r.z1 + r.z2) / 2));
    }
    // Murs
    ctx.strokeStyle = '#c9d4df';
    ctx.lineWidth = 3;
    for (const w of WALLS) {
      let cursor = w.from;
      const segs: [number, number][] = [];
      for (const [a, b] of w.gaps ?? []) {
        segs.push([cursor, a]);
        cursor = b;
      }
      segs.push([cursor, w.to]);
      for (const [a, b] of segs) {
        ctx.beginPath();
        if (w.axis === 'x') {
          ctx.moveTo(X(a), Z(w.at));
          ctx.lineTo(X(b), Z(w.at));
        } else {
          ctx.moveTo(X(w.at), Z(a));
          ctx.lineTo(X(w.at), Z(b));
        }
        ctx.stroke();
      }
    }
    // Portes
    ctx.strokeStyle = '#c08a4a';
    ctx.lineWidth = 2;
    for (const d of DOORS) {
      ctx.beginPath();
      ctx.moveTo(X(d.x - d.width / 2), Z(d.z));
      ctx.lineTo(X(d.x + d.width / 2), Z(d.z));
      ctx.stroke();
      if (d.locked) {
        ctx.fillStyle = '#ffb300';
        ctx.font = `${Math.max(10, scale * 0.4)}px Arial`;
        ctx.fillText('🔒', X(d.x), Z(d.z) - scale * 0.5);
      }
    }
    // Bureaux
    ctx.font = `bold ${Math.max(9, scale * 0.36)}px Arial`;
    for (const d of DESKS) {
      const hasTicket = ticketDesks.has(d.id);
      ctx.fillStyle = d.userId ? '#4a90d9' : '#5d6d7e';
      ctx.fillRect(X(d.x) - scale * 0.7, Z(d.z) - scale * 0.4, scale * 1.4, scale * 0.8);
      ctx.fillStyle = '#fff';
      ctx.fillText(d.id, X(d.x), Z(d.z));
      const user = getUser(d.userId);
      ctx.fillStyle = '#9fb3c8';
      ctx.font = `${Math.max(9, scale * 0.32)}px Arial`;
      const off = d.rotY === 0 ? 1.0 : -1.0;
      ctx.fillText(user ? user.firstName : 'libre', X(d.x), Z(d.z + off));
      ctx.font = `bold ${Math.max(9, scale * 0.36)}px Arial`;
      if (hasTicket) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 6);
        ctx.fillStyle = `rgba(255,82,82,${pulse})`;
        ctx.beginPath();
        ctx.arc(X(d.x) + scale * 0.8, Z(d.z) - scale * 0.5, scale * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Points d'intérêt
    const poi: [number, number, string, string][] = [
      [MY_DESK.x, MY_DESK.z, '#2ecc71', 'Mon poste'],
      [SPOTS.rack.x, SPOTS.rack.z, '#e67e22', 'Baie'],
      [SPOTS.coffee.x - 0.5, SPOTS.coffee.z, '#a1887f', 'Café'],
      [SPOTS.copier.x, SPOTS.copier.z, '#95a5a6', 'Copieur'],
    ];
    for (const [x, z, color, label] of poi) {
      ctx.fillStyle = color;
      ctx.fillRect(X(x) - scale * 0.35, Z(z) - scale * 0.35, scale * 0.7, scale * 0.7);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, X(x), Z(z) + scale * 0.8);
    }
    // Joueur : flèche orientée selon le regard
    ctx.save();
    ctx.translate(X(px), Z(pz));
    ctx.rotate(-yaw);
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(0, -scale * 0.55);
    ctx.lineTo(scale * 0.35, scale * 0.35);
    ctx.lineTo(0, scale * 0.15);
    ctx.lineTo(-scale * 0.35, scale * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
