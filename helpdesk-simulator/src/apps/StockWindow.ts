/** Étagère du helpdesk : prendre / reposer du matériel. */
import { ITEMS, ITEM_IDS } from '../sim/items';
import type { Office } from '../sim/Office';
import { el, escapeHtml } from '../ui/dom';

export function buildStockWindow(office: Office, toast: (t: string, k?: 'ok' | 'warn' | 'error' | 'info') => void): HTMLElement {
  const root = el('div', { class: 'stock' });
  const render = () => {
    const inv = office.state.inventory;
    root.innerHTML = `
      <div class="stock-cols">
        <div><h3>📦 Étagère (stock)</h3><table class="gtable"><thead><tr><th></th><th>Matériel</th><th>Stock</th><th></th></tr></thead><tbody>
        ${ITEM_IDS.map((id) => {
          const n = office.state.stock[id];
          return `<tr><td>${ITEMS[id].icon}</td><td>${escapeHtml(ITEMS[id].name)}${ITEMS[id].tool ? ' <span class="pill grey">outil</span>' : ''}</td><td class="${n === 0 ? 'red-t' : ''}">${n}</td><td><button class="gbtn small" data-take="${id}" ${n === 0 ? 'disabled' : ''}>Prendre</button></td></tr>`;
        }).join('')}</tbody></table>
        <p class="muted">Réassort automatique tous les 3 jours. Les cordons de brassage de la baie sont pris directement dans ce stock.</p></div>
        <div><h3>🎒 Mon inventaire</h3><div class="inv-grid">${inv
          .map((id, i) => `<div class="inv-slot"><span class="hb-key">${i + 1}</span>${id ? `<span class="hb-icon">${ITEMS[id].icon}</span><small>${escapeHtml(ITEMS[id].name)}</small><button class="link-btn" data-back="${i}">Reposer</button>` : '<small class="muted">vide</small>'}</div>`)
          .join('')}</div>
        <p class="muted">Sélectionnez l’objet avec les touches 1 à 9 (ou la molette), puis visez l’équipement et appuyez sur E pour l’utiliser.</p></div>
      </div>`;
    root.querySelectorAll<HTMLElement>('[data-take]').forEach((b) =>
      b.addEventListener('click', () => {
        const err = office.takeItem(b.dataset.take as keyof typeof ITEMS);
        if (err) toast(err, 'warn');
        render();
      }),
    );
    root.querySelectorAll<HTMLElement>('[data-back]').forEach((b) =>
      b.addEventListener('click', () => {
        office.putBack(Number(b.dataset.back));
        render();
      }),
    );
  };
  render();
  return root;
}
