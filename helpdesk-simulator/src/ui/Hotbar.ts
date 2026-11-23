/** Barre d'inventaire (9 emplacements) : touches 1-9, molette, ou toucher un emplacement. */
import { ITEMS } from '../sim/items';
import type { ItemId } from '../sim/types';
import { el, escapeHtml } from './dom';

export class Hotbar {
  readonly root: HTMLElement;
  private label: HTMLElement;
  selected = 0;
  private items: (ItemId | null)[] = [];
  private labelTimer = 0;

  constructor(parent: HTMLElement, private onSelect: (i: number) => void) {
    this.root = el('div', { class: 'hotbar' });
    this.label = el('div', { class: 'hotbar-label' });
    parent.append(this.label, this.root);
    this.root.addEventListener('pointerdown', (e) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (!slot) return;
      e.stopPropagation();
      this.select(Number(slot.dataset.slot));
    });
  }

  render(items: (ItemId | null)[]): void {
    this.items = items;
    this.root.innerHTML = items
      .map((id, i) => `<div class="hb-slot${i === this.selected ? ' on' : ''}" data-slot="${i}"><span class="hb-key">${i + 1}</span>${id ? `<span class="hb-icon">${ITEMS[id].icon}</span>` : ''}</div>`)
      .join('');
  }

  get current(): ItemId | null {
    return this.items[this.selected] ?? null;
  }

  select(i: number): void {
    this.selected = (i + 9) % 9;
    this.render(this.items);
    this.onSelect(this.selected);
    const id = this.current;
    this.label.textContent = id ? ITEMS[id].name : 'Mains libres';
    this.label.classList.add('show');
    clearTimeout(this.labelTimer);
    this.labelTimer = window.setTimeout(() => this.label.classList.remove('show'), 1400);
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
    if (!v) this.label.classList.remove('show');
  }

  static nameOf(id: ItemId | null): string {
    return id ? escapeHtml(ITEMS[id].name) : '';
  }
}
