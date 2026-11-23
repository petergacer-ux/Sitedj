/**
 * Poste utilisateur (bureau Windows simulé).
 * Étape 1 : écran de session ; l'invite de commandes et les outils arrivent à l'étape 5.
 */
import type { DeskDef } from '../data/map';
import { getUser } from '../data/users';
import { formatTime } from '../state/clock';
import { el, escapeHtml } from '../ui/dom';

export function buildUserDesktop(desk: DeskDef, minutes: number): HTMLElement {
  const user = getUser(desk.userId);
  const root = el('div', { class: 'win-desktop' });
  root.innerHTML = `
    <div class="win-icons">
      <div class="win-icon">🗑️<span>Corbeille</span></div>
      <div class="win-icon">📁<span>Explorateur</span></div>
      <div class="win-icon">⬛<span>Invite de commandes</span></div>
      <div class="win-icon">📧<span>Outlook</span></div>
      <div class="win-icon">🖨️<span>Imprimantes</span></div>
    </div>
    <div class="win-center">
      <div class="win-card">
        <div class="win-avatar">${user ? escapeHtml(user.firstName[0] + user.lastName[0]) : '?'}</div>
        <h3>${escapeHtml(desk.pcName)}</h3>
        <p>${user ? `Session de <b>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</b> (${escapeHtml(user.service)})` : 'Poste non attribué'}</p>
        <p>Prise réseau : <b>${escapeHtml(desk.id)}</b></p>
        <p class="muted">Les outils de dépannage (ipconfig, ping, net use, gpupdate, paramètres réseau, Outlook…) arrivent à l'étape 5.</p>
      </div>
    </div>
    <div class="win-taskbar"><span class="win-start">⊞</span><span class="win-search">Rechercher</span><span class="win-clock">${formatTime(minutes)}</span></div>`;
  return root;
}
