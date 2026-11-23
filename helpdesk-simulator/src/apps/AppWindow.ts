/**
 * Fenêtre « logicielle » en HTML au-dessus du canvas 3D (GLPI, bureau Windows,
 * console AD, terminal…). Une seule fenêtre ouverte à la fois.
 */
import { el, escapeHtml } from '../ui/dom';

export interface AppOptions {
  title: string;
  icon?: string;
  /** Classe CSS de thème : 'theme-glpi', 'theme-windows', 'theme-terminal'… */
  theme?: string;
  width?: string;
  height?: string;
}

export class AppWindow {
  private root: HTMLElement;
  private onCloseCb: (() => void) | null = null;
  isOpen = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', { class: 'app-layer hidden' });
    parent.append(this.root);
  }

  open(opts: AppOptions, content: HTMLElement, onClose: () => void): void {
    this.onCloseCb = onClose;
    this.root.innerHTML = '';
    const win = el('div', { class: `app-window ${opts.theme ?? ''}` });
    win.style.width = opts.width ?? 'min(1100px, 94vw)';
    win.style.height = opts.height ?? 'min(680px, 88vh)';
    const bar = el('div', { class: 'app-titlebar' });
    bar.innerHTML = `<span class="app-title">${opts.icon ?? ''} ${escapeHtml(opts.title)}</span><span class="app-hint">Échap pour fermer</span>`;
    const close = el('button', { class: 'app-close', title: 'Fermer (Échap)' }, ['✕']);
    close.addEventListener('click', () => this.close());
    bar.append(close);
    const body = el('div', { class: 'app-body' }, [content]);
    win.append(bar, body);
    this.root.append(win);
    this.root.classList.remove('hidden');
    this.isOpen = true;
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
    const cb = this.onCloseCb;
    this.onCloseCb = null;
    cb?.();
  }
}
