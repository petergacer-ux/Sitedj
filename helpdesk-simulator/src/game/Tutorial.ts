/**
 * Tutoriel du premier lancement : Bernard (le chef) guide le joueur sur un premier ticket simple,
 * étape par étape. Chaque étape est validée en observant l'état réel du jeu.
 */
import { el, escapeHtml } from '../ui/dom';

export interface TutorialStep {
  text: string;
  hint?: string;
  done: () => boolean;
}

export class Tutorial {
  readonly root: HTMLElement;
  index = 0;
  active = false;
  /** Évènements remontés par le jeu (« helpdesk-open », « talk:jmartin »…). */
  readonly flags = new Set<string>();
  private steps: TutorialStep[] = [];

  constructor(
    parent: HTMLElement,
    private onFinish: () => void,
  ) {
    this.root = el('div', { class: 'tuto hidden' });
    parent.append(this.root);
    this.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-act="skip"]')) this.finish();
    });
  }

  start(steps: TutorialStep[], index = 0): void {
    this.steps = steps;
    this.index = index;
    this.active = true;
    this.render();
  }

  update(): void {
    if (!this.active) return;
    let changed = false;
    while (this.index < this.steps.length && this.steps[this.index].done()) {
      this.index++;
      changed = true;
    }
    if (this.index >= this.steps.length) return this.finish();
    if (changed) this.render();
  }

  finish(): void {
    if (!this.active) return;
    this.active = false;
    this.root.classList.add('hidden');
    this.onFinish();
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v || !this.active);
  }

  private render(): void {
    const s = this.steps[this.index];
    if (!s) return;
    this.root.innerHTML = `<div class="tuto-head">🎓 Tutoriel — étape ${this.index + 1}/${this.steps.length}<button class="link-btn light" data-act="skip">Passer</button></div>
      <div class="tuto-text">${escapeHtml(s.text)}</div>${s.hint ? `<div class="tuto-hint">💡 ${escapeHtml(s.hint)}</div>` : ''}
      <div class="tuto-progress">${this.steps.map((_, i) => `<i class="${i < this.index ? 'done' : i === this.index ? 'cur' : ''}"></i>`).join('')}</div>`;
    this.root.classList.remove('hidden');
  }
}
