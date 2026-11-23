/**
 * Contrôles tactiles (iPad, tablettes) :
 * - moitié gauche de l'écran : joystick flottant pour se déplacer (pousser à fond = courir),
 * - moitié droite : glisser pour regarder autour de soi,
 * - boutons : Utiliser (E), Se baisser (C), Plan (M), Pause.
 * Le clavier / la souris restent utilisables en parallèle (iPad avec clavier).
 */
import { el, escapeHtml } from './dom';

export interface TouchHandlers {
  interact(): void;
  toggleCrouch(): boolean;
  toggleMap(): void;
  pause(): void;
  look(dx: number, dy: number): void;
}

/** Vrai sur les appareils dont le pointeur principal est le doigt. */
export function isTouchDevice(): boolean {
  return (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 1;
}

const JOY_RADIUS = 60;

export class TouchControls {
  readonly root: HTMLElement;
  /** Déplacement analogique : x = droite, y = avant, norme 0 → 1. */
  readonly move = { x: 0, y: 0 };
  private joyBase: HTMLElement;
  private joyKnob: HTMLElement;
  private actionBtn: HTMLButtonElement;
  private crouchBtn: HTMLButtonElement;
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private lastAction: string | null = '';

  constructor(parent: HTMLElement, private h: TouchHandlers) {
    this.root = el('div', { class: 'touch-layer hidden' });
    this.joyBase = el('div', { class: 'joy-base hidden' });
    this.joyKnob = el('div', { class: 'joy-knob' });
    this.joyBase.append(this.joyKnob);

    this.actionBtn = el('button', { class: 'tbtn tbtn-action disabled' }, ['Utiliser']);
    this.crouchBtn = el('button', { class: 'tbtn tbtn-crouch' }, ['⬇ Se baisser']);
    const mapBtn = el('button', { class: 'tbtn tbtn-map' }, ['🗺️ Plan']);
    const pauseBtn = el('button', { class: 'tbtn tbtn-pause' }, ['❚❚ Pause']);
    const hint = el('div', { class: 'touch-hint' }, ['Gauche : se déplacer · Droite : regarder']);

    this.bindButton(this.actionBtn, () => this.h.interact());
    this.bindButton(this.crouchBtn, () => this.crouchBtn.classList.toggle('on', this.h.toggleCrouch()));
    this.bindButton(mapBtn, () => this.h.toggleMap());
    this.bindButton(pauseBtn, () => this.h.pause());

    this.root.append(this.joyBase, this.actionBtn, this.crouchBtn, mapBtn, pauseBtn, hint);
    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    this.root.addEventListener('pointermove', (e) => this.onMove(e));
    this.root.addEventListener('pointerup', (e) => this.onUp(e));
    this.root.addEventListener('pointercancel', (e) => this.onUp(e));
    parent.append(this.root);
    // L'indication disparaît après quelques secondes.
    setTimeout(() => hint.classList.add('fade'), 9000);
  }

  private bindButton(b: HTMLElement, fn: () => void): void {
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      fn();
    });
  }

  setVisible(v: boolean): void {
    if (v === !this.root.classList.contains('hidden')) return;
    this.root.classList.toggle('hidden', !v);
    if (!v) this.reset();
  }

  setCrouching(v: boolean): void {
    this.crouchBtn.classList.toggle('on', v);
  }

  /** Texte du bouton d'action (« E — Ouvrir la porte » → « Ouvrir la porte »). */
  setAction(label: string | null): void {
    if (label === this.lastAction) return;
    this.lastAction = label;
    const text = label ? label.split(' — ').slice(1).join(' — ') || label : 'Utiliser';
    this.actionBtn.innerHTML = escapeHtml(text);
    this.actionBtn.classList.toggle('disabled', !label);
  }

  private reset(): void {
    this.joyId = null;
    this.lookId = null;
    this.move.x = this.move.y = 0;
    this.joyBase.classList.add('hidden');
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    if (e.clientX < window.innerWidth * 0.45 && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.joyBase.style.left = `${e.clientX}px`;
      this.joyBase.style.top = `${e.clientY}px`;
      this.joyKnob.style.transform = 'translate(-50%, -50%)';
      this.joyBase.classList.remove('hidden');
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
    this.root.setPointerCapture?.(e.pointerId);
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId === this.joyId) {
      let dx = e.clientX - this.joyOrigin.x;
      let dy = e.clientY - this.joyOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > JOY_RADIUS) {
        dx = (dx / d) * JOY_RADIUS;
        dy = (dy / d) * JOY_RADIUS;
      }
      this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // Petite zone morte au centre
      const n = Math.min(1, d / JOY_RADIUS);
      const k = n < 0.12 ? 0 : 1;
      this.move.x = (dx / JOY_RADIUS) * k;
      this.move.y = (-dy / JOY_RADIUS) * k;
    } else if (e.pointerId === this.lookId) {
      this.h.look(e.clientX - this.lookLast.x, e.clientY - this.lookLast.y);
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.move.x = this.move.y = 0;
      this.joyBase.classList.add('hidden');
    } else if (e.pointerId === this.lookId) this.lookId = null;
  }
}
