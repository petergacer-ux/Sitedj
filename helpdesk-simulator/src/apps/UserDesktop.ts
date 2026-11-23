/**
 * Poste utilisateur (bureau Windows simulé).
 * Étape 1 : écran de session ; l'invite de commandes et les outils arrivent à l'étape 5.
 */
import type { DeskDef } from '../data/map';
import type { Network } from '../network/Network';
import { getUser } from '../data/users';
import { formatTime } from '../state/clock';
import { el, escapeHtml } from '../ui/dom';

export function buildUserDesktop(desk: DeskDef, minutes: number, net: Network): HTMLElement {
  const user = getUser(desk.userId);
  const info = net.hostIp(desk.pcName);
  const statusText: Record<string, string> = {
    dhcp: 'Connecté (DHCP)',
    static: 'Connecté (IP statique)',
    apipa: 'Réseau non identifié — pas d’accès Internet',
    disconnected: 'Câble réseau débranché',
    disabled: 'Carte réseau désactivée',
    off: 'Éteint',
  };
  const ok = info.status === 'dhcp' || info.status === 'static';
  const netCard = `
    <div class="win-net ${ok ? 'ok' : info.status === 'apipa' ? 'warn' : 'bad'}">
      <div class="win-net-title">${ok ? '🖧' : info.status === 'apipa' ? '⚠️' : '❌'} Ethernet — ${escapeHtml(statusText[info.status])}</div>
      <table>
        <tr><td>Adresse IPv4</td><td>${escapeHtml(info.ip ?? '—')}</td></tr>
        <tr><td>Masque</td><td>${escapeHtml(info.mask ?? '—')}</td></tr>
        <tr><td>Passerelle</td><td>${escapeHtml(info.gateway ?? '—')}</td></tr>
        <tr><td>DNS</td><td>${escapeHtml(info.dns ?? '—')}</td></tr>
        <tr><td>Adresse physique</td><td>${escapeHtml(net.host(desk.pcName)?.mac.replace(/:/g, '-') ?? '—')}</td></tr>
      </table>
    </div>`;
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
        ${netCard}
        <p class="muted">L'invite de commandes (ipconfig, ping, net use, gpupdate…) et les autres outils arrivent à l'étape 5.</p>
      </div>
    </div>
    <div class="win-taskbar"><span class="win-start">⊞</span><span class="win-search">Rechercher</span><span class="win-clock">${formatTime(minutes)}</span></div>`;
  return root;
}
