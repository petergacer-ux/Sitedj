/** Notifications en haut à droite (nouveau ticket, messages système…). */
import { el, escapeHtml } from './dom';

export type ToastKind = 'info' | 'ok' | 'warn' | 'error' | 'ticket';

const ICONS: Record<ToastKind, string> = { info: 'ℹ️', ok: '✅', warn: '⚠️', error: '⛔', ticket: '🎫' };

export class Notifications {
  private root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', { class: 'toasts' });
    parent.append(this.root);
  }

  show(text: string, kind: ToastKind = 'info', title?: string, duration = 4500): void {
    const t = el('div', { class: `toast toast-${kind}` });
    t.innerHTML = `<div class="toast-icon">${ICONS[kind]}</div><div class="toast-body">${title ? `<strong>${escapeHtml(title)}</strong>` : ''}<span>${escapeHtml(text)}</span></div>`;
    this.root.prepend(t);
    while (this.root.children.length > 5) this.root.lastElementChild?.remove();
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, duration);
  }
}
