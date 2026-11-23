/**
 * « HelpDesk Pro » : interface de gestion de tickets inspirée de GLPI.
 * Étape 1 : coquille visuelle (le moteur de tickets arrive à l'étape 4).
 */
import type { GameState } from '../state/GameState';
import { formatTime } from '../state/clock';
import { el } from '../ui/dom';

export function buildHelpdeskPro(state: GameState): HTMLElement {
  const root = el('div', { class: 'glpi' });
  root.innerHTML = `
    <aside class="glpi-side">
      <div class="glpi-brand">HelpDesk<b>Pro</b></div>
      <nav>
        <a class="active">🎫 Tickets</a>
        <a>➕ Créer un ticket</a>
        <a>🖥️ Parc informatique</a>
        <a>👥 Annuaire (AD)</a>
        <a>📊 Statistiques</a>
        <a>📚 Base de connaissances</a>
      </nav>
      <div class="glpi-user">Connecté : <b>technicien.helpdesk</b><br>Profil : ${state.levelName}</div>
    </aside>
    <main class="glpi-main">
      <header class="glpi-top">
        <div class="glpi-breadcrumb">Accueil › Assistance › <b>Tickets</b></div>
        <div class="glpi-clock">${state.clock.weekday} — ${formatTime(state.clock.minutes)}</div>
      </header>
      <div class="glpi-filters">
        <span class="chip active">Tous</span><span class="chip">Nouveaux</span><span class="chip">En cours</span><span class="chip">En attente</span><span class="chip">Résolus</span>
        <input class="glpi-search" placeholder="Rechercher un ticket…" disabled>
      </div>
      <table class="glpi-table">
        <thead><tr><th>ID</th><th>Titre</th><th>Demandeur</th><th>Bureau</th><th>Catégorie</th><th>Priorité</th><th>Statut</th><th>Ouvert</th><th>SLA</th></tr></thead>
        <tbody><tr><td colspan="9" class="glpi-empty">
          <div class="empty-icon">📭</div>
          <b>Aucun ticket pour le moment.</b><br>
          Profitez-en pour faire le tour des bureaux, repérer la baie réseau et prendre un café&nbsp;☕<br>
          <small>(Le moteur de tickets et les scénarios arrivent à l'étape 4 du développement.)</small>
        </td></tr></tbody>
      </table>
    </main>`;
  return root;
}
