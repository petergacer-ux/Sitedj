/**
 * Vue rapprochée de la baie : brassage à la souris, au trackpad ou au doigt.
 *  - clic sur un port libre puis sur un second port → pose un cordon (couleur + longueur choisies),
 *  - clic droit sur un cordon / un port occupé → débranche,
 *  - clic gauche sur un port occupé → propose de débrancher (pratique au doigt),
 *  - molette ou glisser vertical → monter / descendre,
 *  - survol → étiquette du port (« PP-01:12 → prise B-12 », « SW-01 Fa0/5 · VLAN 10 »).
 */
import * as THREE from 'three';
import { DESKS } from '../data/map';
import { PATCH_COLORS, PATCH_LENGTHS, patchLengthOk, rackPortPosition } from '../data/rack';
import { getUser } from '../data/users';
import { sound } from '../audio/Sound';
import type { FirstPersonController } from '../engine/FirstPersonController';
import { splitRef, type Network } from '../network/Network';
import type { PortRef } from '../network/types';
import type { Hud } from '../ui/Hud';
import { escapeHtml } from '../ui/dom';
import type { Rack3D } from '../world/Rack3D';

type Toast = (text: string, kind: 'info' | 'ok' | 'warn' | 'error', title?: string) => void;

const STATUS_FR: Record<string, string> = {
  connected: 'connecté',
  notconnect: 'pas de lien',
  disabled: 'désactivé (shutdown)',
  'err-disabled': 'err-disabled',
  inactive: 'inactif (VLAN inexistante)',
};

export class RackController {
  active = false;
  private selected: PortRef | null = null;
  private pendingUnplug: string | null = null;
  private color = 'bleu';
  private length = 1;
  private down: { x: number; y: number; lastY: number; moved: boolean; type: string } | null = null;
  private raycaster = new THREE.Raycaster();

  constructor(
    private net: Network,
    private rack: Rack3D,
    private camera: THREE.PerspectiveCamera,
    private controller: FirstPersonController,
    private hud: Hud,
    private tooltip: HTMLElement,
    private toast: Toast,
    private touchUi: () => boolean,
  ) {}

  enter(): void {
    this.active = true;
    this.selected = null;
    this.pendingUnplug = null;
    this.render();
  }

  exit(): void {
    this.active = false;
    this.selected = null;
    this.pendingUnplug = null;
    this.rack.setHover(null);
    this.rack.setSelected(null);
    this.tooltip.classList.add('hidden');
    this.hud.setFocusHint(null);
  }

  /** Échap : annule d'abord la sélection en cours. Renvoie true si consommé. */
  escape(): boolean {
    if (this.selected || this.pendingUnplug) {
      this.selected = null;
      this.pendingUnplug = null;
      this.rack.setSelected(null);
      this.render();
      return true;
    }
    return false;
  }

  /** Clic dans la barre d'outils (délégation depuis le HUD). */
  handleBarClick(target: HTMLElement): void {
    const el = target.closest<HTMLElement>('[data-rack]');
    if (!el) return;
    const [act, val] = (el.dataset.rack ?? '').split(':');
    if (act === 'color') this.color = val;
    else if (act === 'len') this.length = Number(val);
    else if (act === 'cancel') this.escape();
    else if (act === 'unplug' && this.pendingUnplug) this.unplug(this.pendingUnplug);
    sound.play('click');
    this.render();
  }

  onWheel(e: WheelEvent): void {
    this.controller.nudgeFocus(-Math.sign(e.deltaY) * 0.06, this.rack.minY, this.rack.maxY);
  }

  onPointerDown(e: PointerEvent): void {
    this.down = { x: e.clientX, y: e.clientY, lastY: e.clientY, moved: false, type: e.pointerType };
  }

  onPointerMove(e: PointerEvent): void {
    if (this.down && this.down.type !== 'mouse') {
      // Glisser au doigt : monter / descendre dans la baie
      const dy = e.clientY - this.down.lastY;
      this.down.lastY = e.clientY;
      if (Math.abs(e.clientY - this.down.y) > 8) this.down.moved = true;
      if (this.down.moved) this.controller.nudgeFocus(dy * 0.0015, this.rack.minY, this.rack.maxY);
      return;
    }
    this.hover(e.clientX, e.clientY);
  }

  onPointerUp(e: PointerEvent): void {
    const d = this.down;
    this.down = null;
    if (!d || d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
    if (e.button === 2) this.rightClick(e.clientX, e.clientY);
    else this.leftClick(e.clientX, e.clientY, d.type !== 'mouse');
  }

  // ------------------------------------------------------------------

  private radius(touch: boolean): number {
    return touch ? 30 : 13;
  }

  private cableUnder(x: number, y: number): string | null {
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.rack.pickCable(this.raycaster);
  }

  private hover(x: number, y: number): void {
    const ref = this.rack.pickPort(x, y, this.camera, this.radius(false));
    this.rack.setHover(ref);
    let text: string | null = null;
    if (ref) text = this.portInfo(ref);
    else {
      const cid = this.cableUnder(x, y);
      if (cid) text = this.cableInfo(cid) + ' · clic droit : débrancher';
    }
    if (text) {
      this.tooltip.textContent = text;
      this.tooltip.style.left = `${Math.min(x + 14, window.innerWidth - 340)}px`;
      this.tooltip.style.top = `${y + 16}px`;
      this.tooltip.classList.remove('hidden');
    } else this.tooltip.classList.add('hidden');
  }

  private rightClick(x: number, y: number): void {
    const ref = this.rack.pickPort(x, y, this.camera, this.radius(false));
    const cable = ref ? this.net.cableAt(ref) : null;
    const id = cable?.id ?? this.cableUnder(x, y);
    if (id) this.unplug(id);
  }

  private leftClick(x: number, y: number, touch: boolean): void {
    const ref = this.rack.pickPort(x, y, this.camera, this.radius(touch));
    if (touch && ref) this.hoverAtTouch(ref, x, y);
    this.pendingUnplug = null;
    if (!ref) {
      const cid = this.cableUnder(x, y);
      if (cid) this.pendingUnplug = cid;
      this.render();
      return;
    }
    const occupied = this.net.cableAt(ref);
    if (occupied) {
      if (this.selected) this.toast(`Le port ${this.short(ref)} est déjà occupé.`, 'warn', 'Brassage');
      else this.pendingUnplug = occupied.id;
      this.render();
      return;
    }
    if (!this.selected) {
      this.selected = ref;
      this.rack.setSelected(ref);
      sound.play('click');
    } else if (this.selected === ref) {
      this.selected = null;
      this.rack.setSelected(null);
    } else {
      this.patch(this.selected, ref);
    }
    this.render();
  }

  private hoverAtTouch(ref: PortRef, x: number, y: number): void {
    this.rack.setHover(ref);
    this.tooltip.textContent = this.portInfo(ref);
    this.tooltip.style.left = `${Math.min(x + 14, window.innerWidth - 340)}px`;
    this.tooltip.style.top = `${Math.max(10, y - 60)}px`;
    this.tooltip.classList.remove('hidden');
  }

  private patch(a: PortRef, b: PortRef): void {
    const [da, pa] = splitRef(a);
    const [db, pb] = splitRef(b);
    const posA = rackPortPosition(da, pa)!;
    const posB = rackPortPosition(db, pb)!;
    if (!patchLengthOk(posA, posB, this.length)) {
      const need = PATCH_LENGTHS.find((l) => patchLengthOk(posA, posB, l));
      this.toast(`Cordon de ${fmtLen(this.length)} trop court${need ? ` : prenez-en un de ${fmtLen(need)}` : ''}.`, 'warn', 'Brassage');
      sound.play('denied');
      return;
    }
    const r = this.net.connect(a, b, { kind: 'patch', color: this.color, length: this.length });
    if (!r.ok) {
      this.toast(r.error, 'error', 'Brassage');
      return;
    }
    sound.play('plug');
    this.selected = null;
    this.rack.setSelected(null);
    this.toast(`${this.short(a)} ↔ ${this.short(b)} (cordon ${colorName(this.color).toLowerCase()} ${fmtLen(this.length)})`, 'ok', 'Cordon posé');
  }

  private unplug(cableId: string): void {
    const info = this.cableInfo(cableId);
    this.net.disconnect(cableId);
    this.pendingUnplug = null;
    sound.play('plug');
    this.toast(info, 'info', 'Cordon débranché');
    this.render();
  }

  private short(ref: PortRef): string {
    const [d, p] = splitRef(ref);
    return d.startsWith('PP-') ? `${d} port ${p}` : `${d} ${p}`;
  }

  private cableInfo(id: string): string {
    const c = this.net.state.cables.find((x) => x.id === id);
    if (!c) return '';
    return `Cordon ${colorName(c.color).toLowerCase()} ${fmtLen(c.length)} : ${this.short(c.a)} ↔ ${c.b ? this.short(c.b) : '(libre)'}`;
  }

  /** Étiquette lisible d'un port de la baie. */
  portInfo(ref: PortRef): string {
    const [d, p] = splitRef(ref);
    const net = this.net;
    const cable = net.cableAt(ref);
    const other = cable ? (cable.a === ref ? cable.b : cable.a) : null;
    if (d.startsWith('PP-')) {
      const jack = net.jackForPanelPort(ref);
      const jackId = jack ? splitRef(jack)[0] : null;
      const desk = DESKS.find((x) => x.id === jackId);
      const who = desk ? (getUser(desk.userId)?.firstName ?? 'bureau libre') : jackId === 'HD-01' ? 'helpdesk' : jackId === 'P-01' ? 'imprimante Compta' : '';
      const dest = jackId ? `prise ${jackId}${who ? ` (${who})` : ''}` : 'non câblé (réserve)';
      return `PP-01 port ${p} → ${dest} · ${other ? `brassé vers ${this.short(other)}` : 'non brassé'}`;
    }
    const sw = net.state.switches[d];
    if (sw) {
      const cfg = sw.running.ports[p];
      const st = net.portStatus(d, p);
      const vlan = cfg.mode === 'trunk' ? 'trunk' : `VLAN ${cfg.accessVlan} (${sw.running.vlans[cfg.accessVlan] ?? '?'})`;
      const l = net.link(ref);
      const desc = cfg.description ? ` · « ${cfg.description} »` : '';
      const peer = l.peer ? (l.up ? ` → ${splitRef(l.peer)[0]}` : ` (en face : ${splitRef(l.peer)[0]}${l.reason === 'peer-down' ? ', éteint ou désactivé' : ''})`) : '';
      return `${d} ${p} · ${vlan} · ${STATUS_FR[st] ?? st}${peer}${desc}`;
    }
    const l = net.link(ref);
    return `${d} ${p} · ${l.up ? `lien actif → ${l.peer}` : 'pas de lien'}`;
  }

  /** Barre d'outils en bas de l'écran. */
  private render(): void {
    if (!this.active) return;
    const touch = this.touchUi();
    const colors = PATCH_COLORS.map(
      (c) =>
        `<button class="swatch${c.id === this.color ? ' on' : ''}" data-rack="color:${c.id}" title="${c.name}" style="background:#${c.hex.toString(16).padStart(6, '0')}"></button>`,
    ).join('');
    const lengths = PATCH_LENGTHS.map((l) => `<button class="btn small${l === this.length ? ' on' : ''}" data-rack="len:${l}">${fmtLen(l)}</button>`).join('');
    let status: string;
    if (this.pendingUnplug) {
      status = `${escapeHtml(this.cableInfo(this.pendingUnplug))} <button class="btn small danger-btn" data-rack="unplug">Débrancher</button> <button class="btn small" data-rack="cancel">Annuler</button>`;
    } else if (this.selected) {
      status = `Port <b>${escapeHtml(this.short(this.selected))}</b> sélectionné : ${touch ? 'touchez' : 'cliquez'} le second port. <button class="btn small" data-rack="cancel">Annuler</button>`;
    } else {
      status = touch
        ? 'Touchez un port libre puis un second port pour poser un cordon · touchez un port occupé pour débrancher · glissez pour monter / descendre'
        : 'Cliquez un port libre puis un second port · clic droit sur un cordon : débrancher · molette : monter / descendre';
    }
    this.hud.setFocusHint(
      `<div class="rackbar">
        <div class="rackbar-row"><b>Baie réseau</b><span class="rackbar-sep"></span>Cordon : ${colors}<span class="rackbar-sep"></span>${lengths}<span class="rackbar-sep"></span><button class="btn small" data-act="exit-focus">✕ Quitter</button></div>
        <div class="rackbar-row rackbar-status">${status}</div>
      </div>`,
    );
  }
}

function fmtLen(l: number): string {
  return `${String(l).replace('.', ',')} m`;
}

function colorName(id: string): string {
  return PATCH_COLORS.find((c) => c.id === id)?.name ?? id;
}
