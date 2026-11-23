/** Boîte de dialogue en bas de l'écran pour parler aux PNJ. */
import { el, escapeHtml } from './dom';

export interface DialogChoice {
  text: string;
  action: () => void;
}

export class DialogBox {
  private root: HTMLElement;
  private onKey = (e: KeyboardEvent) => this.handleKey(e);
  private choices: DialogChoice[] = [];
  isOpen = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', { class: 'dialog hidden' });
    parent.append(this.root);
  }

  /** Affiche une réplique et des choix (touches 1 à 9 ou clic). */
  show(speaker: string, subtitle: string, text: string, choices: DialogChoice[]): void {
    this.choices = choices;
    this.root.innerHTML = `
      <div class="dialog-speaker">${escapeHtml(speaker)} <span>${escapeHtml(subtitle)}</span></div>
      <div class="dialog-text">${escapeHtml(text)}</div>
      <div class="dialog-choices"></div>`;
    const list = this.root.querySelector('.dialog-choices')!;
    choices.forEach((c, i) => {
      const b = el('button', { class: 'dialog-choice' }, [`${i + 1}. ${c.text}`]);
      b.addEventListener('click', () => c.action());
      list.append(b);
    });
    this.root.classList.remove('hidden');
    if (!this.isOpen) document.addEventListener('keydown', this.onKey);
    this.isOpen = true;
  }

  hide(): void {
    this.root.classList.add('hidden');
    document.removeEventListener('keydown', this.onKey);
    this.isOpen = false;
  }

  private handleKey(e: KeyboardEvent): void {
    const n = Number(e.key);
    if (n >= 1 && n <= this.choices.length) {
      e.preventDefault();
      this.choices[n - 1].action();
    }
  }
}
