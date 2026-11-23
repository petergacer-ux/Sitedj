/**
 * « HelpDesk Pro » : gestion de tickets inspirée de GLPI (sans en reprendre la marque),
 * + console Active Directory, parc, prêts de matériel, SSH vers les switchs,
 * base de connaissances, statistiques et (bac à sable) création de pannes.
 */
import { DESKS } from '../data/map';
import { SCENARIOS, getScenario } from '../data/scenarios';
import { USERS, getUser } from '../data/users';
import type { Network } from '../network/Network';
import type { Office } from '../sim/Office';
import type { GameState } from '../state/GameState';
import { formatTime } from '../state/clock';
import type { ResolveResult, TicketSystem } from '../tickets/TicketSystem';
import { PRIORITY_NAMES, STATUS_NAMES, type Ticket, type TicketStatus } from '../tickets/types';
import { el, escapeHtml } from '../ui/dom';
import { buildAdConsole } from './AdConsole';
import { buildSwitchConsole } from './SwitchConsole';

export interface HelpdeskDeps {
  tickets: TicketSystem;
  office: Office;
  net: Network;
  state: GameState;
  now: () => number;
  sandbox: boolean;
  myHost: string;
  onResolved: (t: Ticket, r: ResolveResult) => void;
  onReload: (switchId: string) => void;
  createScenario: (id: string) => void;
  toast: (text: string, kind?: 'ok' | 'warn' | 'error' | 'info') => void;
  /** Ouvre directement un ticket (depuis une notification). */
  openTicket?: number;
}

type Tab = 'tickets' | 'ad' | 'parc' | 'prets' | 'ssh' | 'kb' | 'stats' | 'sandbox';

const FOLLOWUPS = [
  'Bonjour, j’ai bien pris en compte votre demande, je passe à votre bureau dans quelques minutes.',
  'Pouvez-vous me préciser le message d’erreur exact (ou une capture d’écran) ?',
  'Depuis quand le problème est-il présent ? Avez-vous fait une manipulation particulière ?',
  'Pouvez-vous redémarrer votre poste et me dire si le problème persiste ?',
  'Je vous rappelle sur votre poste pour faire le point.',
];
const SOLUTIONS = [
  'Câble réseau rebranché / remplacé.',
  'Port du switch réactivé / passé dans la bonne VLAN, configuration sauvegardée.',
  'Brassage de la prise réalisé dans la baie.',
  'Compte déverrouillé et mot de passe réinitialisé (changement à la prochaine connexion).',
  'Droits AD corrigés (ajout au groupe), session rouverte.',
  'Lecteur réseau remappé (gpupdate /force).',
  'File d’impression purgée / consommable remplacé.',
  'Profil Outlook recréé / boîte aux lettres nettoyée.',
  'Configuration IP repassée en DHCP / carte réseau réactivée.',
  'Matériel remplacé ou ajouté (RAM, écran, câble vidéo).',
  'Explications données à l’utilisateur.',
];

export function fmtAbs(abs: number): string {
  const day = Math.floor(abs / 1440);
  return `J${day} ${formatTime(abs % 1440)}`;
}

function fmtDuration(min: number): string {
  const neg = min < 0;
  const m = Math.abs(Math.round(min));
  const s = `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  return neg ? `−${s}` : s;
}

export function buildHelpdeskPro(d: HelpdeskDeps): HTMLElement {
  const root = el('div', { class: 'glpi' });
  let tab: Tab = 'tickets';
  let filter: 'all' | TicketStatus | 'done' = 'all';
  let current: number | null = d.openTicket ?? null;
  let sshHost: string | null = null;

  const tabs: [Tab, string][] = [
    ['tickets', '🎫 Tickets'],
    ['ad', '👥 Annuaire (AD)'],
    ['parc', '🖥️ Parc informatique'],
    ['prets', '💼 Prêts de matériel'],
    ['ssh', '🔐 Terminal SSH'],
    ['kb', '📚 Base de connaissances'],
    ['stats', '📊 Statistiques'],
  ];
  if (d.sandbox) tabs.push(['sandbox', '🧪 Créer une panne']);

  const side = el('aside', { class: 'glpi-side' });
  const main = el('main', { class: 'glpi-main' });
  root.append(side, main);

  const renderSide = () => {
    const open = d.tickets.open.length;
    side.innerHTML = `
      <div class="glpi-brand">HelpDesk<b>Pro</b></div>
      <nav>${tabs.map(([id, label]) => `<a data-tab="${id}" class="${id === tab ? 'active' : ''}">${label}${id === 'tickets' && open ? ` <span class="badge">${open}</span>` : ''}</a>`).join('')}</nav>
      <div class="glpi-user">Connecté : <b>technicien.helpdesk</b><br>Profil : ${escapeHtml(d.state.levelName)}</div>`;
    side.querySelectorAll<HTMLElement>('[data-tab]').forEach((a) =>
      a.addEventListener('click', () => {
        tab = a.dataset.tab as Tab;
        current = null;
        render();
      }),
    );
  };

  const header = (title: string) =>
    `<header class="glpi-top"><div class="glpi-breadcrumb">Accueil › <b>${title}</b></div><div class="glpi-clock">${escapeHtml(d.state.clock.weekday)} — ${formatTime(d.state.clock.minutes)}</div></header>`;

  // ------------------------------------------------------------------ tickets
  const renderTickets = () => {
    const now = d.now();
    const list = d.tickets.state.tickets
      .filter((t) => (filter === 'all' ? t.status !== 'closed' : filter === 'done' ? t.status === 'solved' || t.status === 'closed' : t.status === filter))
      .sort((a, b) => b.priority - a.priority || a.openedAt - b.openedAt);
    const chip = (id: typeof filter, label: string) => `<span class="chip${filter === id ? ' active' : ''}" data-filter="${id}">${label}</span>`;
    main.innerHTML = `${header('Assistance › Tickets')}
      <div class="glpi-filters">${chip('all', 'Ouverts')}${chip('new', 'Nouveaux')}${chip('assigned', 'En cours')}${chip('pending', 'En attente')}${chip('done', 'Résolus / Clos')}</div>
      <div class="gtable-wrap"><table class="gtable glpi-table"><thead><tr><th>ID</th><th>Titre</th><th>Demandeur</th><th>Bureau</th><th>Catégorie</th><th>Priorité</th><th>Statut</th><th>Ouvert</th><th>SLA</th></tr></thead><tbody>
      ${
        list.length
          ? list
              .map((t) => {
                const u = getUser(t.requester);
                const rem = d.tickets.slaRemaining(t, now);
                const sla = t.status === 'solved' || t.status === 'closed' ? (t.slaMissed ? '<span class="red-t">dépassé</span>' : '<span class="green-t">respecté</span>') : `<span class="${rem < 0 ? 'red-t' : rem < 30 ? 'orange-t' : ''}">${fmtDuration(rem)}</span>`;
                return `<tr data-ticket="${t.id}" class="${t.status === 'new' ? 'unread' : ''}"><td>${t.id}</td><td>${t.channel === 'phone' ? '📞 ' : t.channel === 'visit' ? '🚶 ' : ''}${escapeHtml(t.title)}${t.reopenCount ? ' <span class="pill red">rouvert</span>' : ''}</td><td>${escapeHtml(u ? `${u.firstName} ${u.lastName}` : t.requester)}</td><td>${t.desk}</td><td>${t.category}</td><td><span class="prio p${t.priority}">${PRIORITY_NAMES[t.priority]}</span></td><td><span class="st st-${t.status}">${STATUS_NAMES[t.status]}</span></td><td>${fmtAbs(t.openedAt)}</td><td>${sla}</td></tr>`;
              })
              .join('')
          : `<tr><td colspan="9" class="glpi-empty"><div class="empty-icon">📭</div><b>Aucun ticket ici.</b><br>Les demandes arrivent au fil de la journée (notifications, téléphone, visites).</td></tr>`
      }
      </tbody></table></div>`;
    main.querySelectorAll<HTMLElement>('[data-filter]').forEach((c) =>
      c.addEventListener('click', () => {
        filter = c.dataset.filter as typeof filter;
        render();
      }),
    );
    main.querySelectorAll<HTMLElement>('[data-ticket]').forEach((r) =>
      r.addEventListener('click', () => {
        current = Number(r.dataset.ticket);
        render();
      }),
    );
  };

  const renderTicket = (t: Ticket) => {
    const now = d.now();
    const u = getUser(t.requester);
    const rem = d.tickets.slaRemaining(t, now);
    const closed = t.status === 'solved' || t.status === 'closed';
    const author = (f: Ticket['followups'][0]) => (f.kind === 'tech' || f.kind === 'solution' ? '🧑‍🔧 ' : f.kind === 'system' ? '⚙️ ' : '👤 ') + f.author;
    main.innerHTML = `${header(`Tickets › #${t.id}`)}
      <div class="ticket">
        <div class="ticket-head">
          <button class="gbtn" data-act="back">← Liste</button>
          <h2>#${t.id} — ${escapeHtml(t.title)}</h2>
          <span class="st st-${t.status}">${STATUS_NAMES[t.status]}</span>
        </div>
        <div class="ticket-grid">
          <div><span>Demandeur</span><b>${escapeHtml(u ? `${u.firstName} ${u.lastName}` : t.requester)} (${u?.service ?? ''})</b></div>
          <div><span>Bureau / poste</span><b>${t.desk} · ${t.host}</b></div>
          <div><span>Catégorie</span><b>${t.category}</b></div>
          <div><span>Priorité</span><b><span class="prio p${t.priority}">${PRIORITY_NAMES[t.priority]}</span></b></div>
          <div><span>Ouvert le</span><b>${fmtAbs(t.openedAt)} ${t.channel === 'phone' ? '(téléphone)' : t.channel === 'visit' ? '(visite)' : ''}</b></div>
          <div><span>SLA</span><b class="${!closed && rem < 0 ? 'red-t' : ''}">${closed ? (t.slaMissed ? 'dépassé' : 'respecté') : rem < 0 ? `dépassé de ${fmtDuration(-rem)}` : `${fmtDuration(rem)} restantes`}</b></div>
        </div>
        <div class="ticket-desc"><div class="tl-author">👤 ${escapeHtml(u ? `${u.firstName} ${u.lastName}` : t.requester)} · ${fmtAbs(t.openedAt)}</div>${escapeHtml(t.description).replace(/\n/g, '<br>')}</div>
        <div class="timeline">${t.followups
          .map((f) => `<div class="tl tl-${f.kind}"><div class="tl-author">${escapeHtml(author(f))} · ${fmtAbs(f.at)}</div>${escapeHtml(f.text).replace(/\n/g, '<br>')}</div>`)
          .join('')}</div>
        ${
          closed
            ? `<p class="muted">${t.satisfaction !== null ? `Satisfaction de l’utilisateur : <b>${t.satisfaction} %</b> · XP : +${t.xp}` : ''}</p>`
            : `<div class="ticket-actions">
          ${t.status === 'new' || t.status === 'pending' ? '<button class="gbtn primary" data-act="take">✋ Prendre en charge</button>' : ''}
          <button class="gbtn" data-act="show-follow">💬 Répondre / ajouter un suivi</button>
          ${t.status !== 'pending' ? '<button class="gbtn" data-act="pending">⏸ Mettre en attente</button>' : ''}
          <button class="gbtn success" data-act="show-solve">✅ Résoudre</button>
          <button class="gbtn" data-act="show-escalate">⬆️ Escalader au niveau 2</button>
        </div>
        <div class="ticket-form hidden" id="f-follow">
          <select id="follow-pre"><option value="">— Message prédéfini —</option>${FOLLOWUPS.map((f) => `<option>${escapeHtml(f)}</option>`).join('')}</select>
          <textarea id="follow-text" rows="3" placeholder="Votre message à l’utilisateur…"></textarea>
          <button class="gbtn primary" data-act="follow">Envoyer le suivi</button>
        </div>
        <div class="ticket-form hidden" id="f-solve">
          <select id="solve-pre"><option value="">— Solution type —</option>${SOLUTIONS.map((f) => `<option>${escapeHtml(f)}</option>`).join('')}</select>
          <textarea id="solve-text" rows="3" placeholder="Décrivez la solution appliquée…"></textarea>
          <p class="muted">⚠️ Le demandeur vérifie : si le problème n’est pas réellement corrigé, il rouvrira le ticket.</p>
          <button class="gbtn success" data-act="solve">Valider la solution</button>
        </div>
        <div class="ticket-form hidden" id="f-escalate">
          <textarea id="esc-text" rows="2" placeholder="Motif de l’escalade (le niveau 2 s’en charge, sans XP pour vous)"></textarea>
          <button class="gbtn" data-act="escalate">Escalader</button>
        </div>`
        }
      </div>`;
    const q = <T extends HTMLElement>(s: string) => main.querySelector<T>(s)!;
    main.querySelector('#follow-pre')?.addEventListener('change', (e) => (q<HTMLTextAreaElement>('#follow-text').value = (e.target as HTMLSelectElement).value));
    main.querySelector('#solve-pre')?.addEventListener('change', (e) => (q<HTMLTextAreaElement>('#solve-text').value = (e.target as HTMLSelectElement).value));
    main.querySelectorAll<HTMLElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act!;
        const show = (id: string) => ['#f-follow', '#f-solve', '#f-escalate'].forEach((x) => main.querySelector(x)?.classList.toggle('hidden', x !== id));
        if (act === 'back') {
          current = null;
          render();
        } else if (act === 'take') {
          d.tickets.take(t.id, d.now());
          render();
        } else if (act === 'pending') {
          d.tickets.setPending(t.id, d.now());
          render();
        } else if (act === 'show-follow') show('#f-follow');
        else if (act === 'show-solve') show('#f-solve');
        else if (act === 'show-escalate') show('#f-escalate');
        else if (act === 'follow') {
          const text = q<HTMLTextAreaElement>('#follow-text').value.trim();
          if (!text) return d.toast('Écrivez un message.', 'warn');
          if (t.status === 'new') d.tickets.take(t.id, d.now());
          d.tickets.addFollowup(t.id, 'technicien.helpdesk', text, 'tech', d.now());
          d.toast(`Suivi envoyé à ${u?.firstName ?? t.requester}.`, 'ok');
          render();
        } else if (act === 'solve') {
          const text = q<HTMLTextAreaElement>('#solve-text').value.trim();
          if (!text) return d.toast('Décrivez la solution appliquée.', 'warn');
          const r = d.tickets.resolve(t.id, text, d.now());
          d.onResolved(t, r);
          render();
        } else if (act === 'escalate') {
          d.tickets.escalate(t.id, q<HTMLTextAreaElement>('#esc-text').value.trim(), d.now());
          d.toast(`Ticket #${t.id} transmis au niveau 2.`, 'info');
          current = null;
          render();
        }
      }),
    );
  };

  // ------------------------------------------------------------------ parc
  const renderParc = () => {
    const rows = Object.values(d.net.state.hosts)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((h) => {
        const ip = d.net.hostIp(h.id);
        const pc = d.office.pc(h.id);
        const st: Record<string, string> = { dhcp: '🟢 DHCP', static: '🟢 statique', apipa: '🟠 APIPA', disconnected: '🔴 pas de lien', disabled: '⚪ carte désactivée', off: '⚫ éteint' };
        return `<tr><td>${h.id}</td><td>${escapeHtml(pc?.user ?? (h.kind === 'server' ? 'serveur' : h.kind === 'printer' ? 'imprimante' : '—'))}</td><td>${ip.ip ?? '—'}</td><td>${ip.vlan ?? '—'}</td><td>${st[ip.status]}</td><td>${h.mac}</td></tr>`;
      })
      .join('');
    const sws = Object.values(d.net.state.switches)
      .filter((s) => !s.unmanaged)
      .map((s) => {
        const ports = Object.keys(s.running.ports);
        const up = ports.filter((p) => d.net.portStatus(s.id, p) === 'connected').length;
        return `<tr><td>${s.running.hostname}</td><td>${s.running.mgmt?.ip ?? '—'}</td><td>${up}/${ports.length} ports actifs</td><td>${s.rebooting ? '🟠 redémarrage…' : d.net.hasUnsavedChanges(s.id) ? '<span class="orange-t">⚠ config non sauvegardée</span>' : '🟢 sauvegardée'}</td></tr>`;
      })
      .join('');
    main.innerHTML = `${header('Parc informatique')}
      <div class="glpi-pad"><h3>Équipements réseau</h3>
      <table class="gtable"><thead><tr><th>Switch</th><th>IP de management</th><th>Ports</th><th>Configuration</th></tr></thead><tbody>${sws}</tbody></table>
      <h3>Ordinateurs, serveurs, imprimantes</h3>
      <table class="gtable"><thead><tr><th>Nom</th><th>Utilisateur</th><th>Adresse IP</th><th>VLAN</th><th>État</th><th>MAC</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };

  // ------------------------------------------------------------------ prêts
  const renderPrets = () => {
    const loans = d.office.state.loans;
    main.innerHTML = `${header('Prêts de matériel')}
      <div class="glpi-pad">
        <h3>Nouvelle fiche de prêt</h3>
        <div class="loan-form">
          <label>Emprunteur<select id="ln-user">${[...USERS].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((u) => `<option value="${u.id}">${u.lastName.toUpperCase()} ${u.firstName} (${u.service})</option>`).join('')}</select></label>
          <label>Matériel<select id="ln-item"><option>Portable de prêt Dell Latitude 5440</option><option>Station d’accueil USB-C</option><option>Écran 24"</option></select></label>
          <label>N° de série / inventaire<select id="ln-serial"><option>PRET-01</option><option>PRET-02</option><option>PRET-03</option></select></label>
          <label>Du<input id="ln-from" value="${escapeHtml(d.state.clock.weekday)}"></label>
          <label>Au<input id="ln-to" placeholder="date de retour prévue"></label>
          <label>État au départ<select id="ln-cond"><option>Bon état, chargeur fourni</option><option>Rayures légères</option></select></label>
          <label class="chk"><input type="checkbox" id="ln-sign"> L’emprunteur s’engage à restituer le matériel en bon état (charte informatique)</label>
          <button class="gbtn primary" data-act="save-loan">Enregistrer la fiche de prêt</button>
        </div>
        <h3>Prêts en cours</h3>
        <table class="gtable"><thead><tr><th>N°</th><th>Emprunteur</th><th>Matériel</th><th>Série</th><th>Période</th><th>Remis</th><th></th></tr></thead><tbody>
        ${loans.map((l) => `<tr><td>${l.id}</td><td>${escapeHtml(getUser(l.user)?.firstName ?? l.user)} ${escapeHtml(getUser(l.user)?.lastName ?? '')}</td><td>${escapeHtml(l.item)}</td><td>${l.serial}</td><td>${escapeHtml(l.from)} → ${escapeHtml(l.to)}</td><td>${l.returned ? 'rendu' : l.delivered ? '✅' : '⏳ à remettre (parlez-lui avec le portable en main)'}</td><td>${!l.returned && l.delivered ? `<button class="link-btn" data-return="${l.id}">Retour</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Aucun prêt.</td></tr>'}
        </tbody></table>
      </div>`;
    main.querySelector('[data-act="save-loan"]')!.addEventListener('click', () => {
      const v = (id: string) => main.querySelector<HTMLInputElement | HTMLSelectElement>(id)!.value;
      if (!v('#ln-to').trim()) return d.toast('Indiquez la date de retour prévue.', 'warn');
      if (!main.querySelector<HTMLInputElement>('#ln-sign')!.checked) return d.toast('L’engagement de l’emprunteur doit être coché.', 'warn');
      d.office.state.loans.push({ id: d.office.state.nextLoanId++, user: v('#ln-user'), item: v('#ln-item'), serial: v('#ln-serial'), from: v('#ln-from'), to: v('#ln-to'), condition: v('#ln-cond'), delivered: false, returned: false });
      d.office.changed();
      d.toast('Fiche de prêt enregistrée. Prenez le portable dans l’étagère et remettez-le à l’utilisateur.', 'ok');
      render();
    });
    main.querySelectorAll<HTMLElement>('[data-return]').forEach((b) =>
      b.addEventListener('click', () => {
        const l = d.office.state.loans.find((x) => x.id === Number(b.dataset.return));
        if (l) {
          l.returned = true;
          d.office.state.stock.laptop++;
          d.office.changed();
        }
        render();
      }),
    );
  };

  // ------------------------------------------------------------------ SSH
  const renderSsh = () => {
    main.innerHTML = `${header('Terminal SSH')}<div class="glpi-pad ssh-pad">
      <div class="ssh-bar">Se connecter à :
        ${Object.values(d.net.state.switches)
          .filter((s) => !s.unmanaged)
          .map((s) => `<button class="gbtn${sshHost === s.id ? ' primary' : ''}" data-ssh="${s.id}">${s.running.hostname} (${s.running.mgmt?.ip})</button>`)
          .join('')}
      </div><div class="ssh-term"></div></div>`;
    const area = main.querySelector('.ssh-term')!;
    main.querySelectorAll<HTMLElement>('[data-ssh]').forEach((b) =>
      b.addEventListener('click', () => {
        sshHost = b.dataset.ssh!;
        renderSsh();
      }),
    );
    if (sshHost) {
      const ip = d.net.state.switches[sshHost].running.mgmt?.ip ?? '';
      if (d.net.ping(d.myHost, ip).result !== 'ok') {
        area.innerHTML = `<pre class="term term-ios term-static">$ ssh admin@${ip}\nssh: connect to host ${ip} port 22: Connection timed out\n\n(Le switch est injoignable depuis votre poste : vérifiez le réseau, ou utilisez le câble console dans la baie.)</pre>`;
      } else {
        const t = buildSwitchConsole(d.net, sshHost, () => d.onReload(sshHost!), 'ssh', () => {
          sshHost = null;
          renderSsh();
        });
        area.append(t.root);
      }
    }
  };

  // ------------------------------------------------------------------ base de connaissances
  const renderKb = () => {
    const seen = new Set(d.tickets.state.tickets.map((t) => t.scenario));
    const list = SCENARIOS.filter((s) => seen.has(s.id) || d.sandbox);
    main.innerHTML = `${header('Base de connaissances')}<div class="glpi-pad kb">
      <details open><summary><b>📌 Mémo : commandes utiles</b></summary>
      <div class="kb-cols"><div><h4>Switch (Cisco IOS)</h4><pre>enable
configure terminal
interface fastEthernet 0/5
interface range fa0/1 - 8
switchport mode access
switchport access vlan 20
switchport mode trunk
switchport trunk allowed vlan add 30
shutdown / no shutdown
description Bureau B-12
vlan 20  →  name COMPTA
end
show vlan brief
show interfaces status
show interfaces trunk
show mac address-table
show running-config
copy running-config startup-config
write memory</pre></div><div><h4>Poste Windows</h4><pre>ipconfig /all
ipconfig /release
ipconfig /renew
ping srv-fichiers
nslookup srv-fichiers
tracert www.google.fr
net use
net use S: \\\\SRV-FICHIERS\\Compta
net use S: /delete
net user jmartin /domain
gpupdate /force
systeminfo
shutdown /r</pre><h4>Plan d’adressage</h4><pre>VLAN 10 UTILISATEURS  192.168.10.0/24
VLAN 20 COMPTA        192.168.20.0/24
VLAN 30 IMPRIMANTES   192.168.30.0/24
VLAN 99 ADMIN         192.168.99.0/24
Passerelles : .254 (RT-FW-01)
SRV-01 (AD/DNS/DHCP) : 192.168.99.10
SW-01 : .99.2   SW-02 : .99.3</pre></div></div></details>
      ${list.length ? '' : '<p class="muted">Les fiches apparaissent au fur et à mesure des tickets rencontrés.</p>'}
      ${list
        .map(
          (s) => `<details><summary>${s.category} — <b>${escapeHtml(s.titles[0])}</b></summary><h4>Indices</h4><ul>${s.clues.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul><h4>Solution</h4><p>${escapeHtml(s.solution)}</p></details>`,
        )
        .join('')}</div>`;
  };

  // ------------------------------------------------------------------ statistiques
  const renderStats = () => {
    const all = d.tickets.state.tickets;
    const done = all.filter((t) => t.status === 'solved' || t.status === 'closed');
    const slaOk = done.filter((t) => !t.slaMissed && !t.escalated).length;
    const byCat = new Map<string, number>();
    for (const t of all) byCat.set(t.category, (byCat.get(t.category) ?? 0) + 1);
    const max = Math.max(1, ...byCat.values());
    main.innerHTML = `${header('Statistiques')}<div class="glpi-pad">
      <div class="kpis">
        <div class="kpi"><b>${all.length}</b><span>tickets reçus</span></div>
        <div class="kpi"><b>${done.length}</b><span>résolus / clos</span></div>
        <div class="kpi"><b>${done.length ? Math.round((slaOk / done.length) * 100) : 100} %</b><span>SLA respectés</span></div>
        <div class="kpi"><b>${Math.round(d.state.satisfaction)} %</b><span>satisfaction</span></div>
        <div class="kpi"><b>${all.filter((t) => t.reopenCount).length}</b><span>tickets rouverts</span></div>
      </div>
      <h3>Tickets par catégorie</h3>
      ${[...byCat.entries()].map(([c, n]) => `<div class="hbar"><span>${c}</span><div><i style="width:${(n / max) * 100}%"></i></div><b>${n}</b></div>`).join('') || '<p class="muted">Pas encore de données.</p>'}
    </div>`;
  };

  // ------------------------------------------------------------------ bac à sable
  const renderSandbox = () => {
    main.innerHTML = `${header('Bac à sable › Créer une panne')}<div class="glpi-pad">
      <p>Choisissez une panne à provoquer : elle est injectée dans le monde et un ticket est créé.</p>
      <table class="gtable"><thead><tr><th>Niveau</th><th>Catégorie</th><th>Scénario</th><th></th></tr></thead><tbody>
      ${SCENARIOS.map((s) => `<tr><td>${['Stagiaire', 'N1', 'N2', 'Admin'][s.minLevel]}</td><td>${s.category}</td><td>${escapeHtml(s.titles[0])}</td><td><button class="gbtn" data-sc="${s.id}">Déclencher</button></td></tr>`).join('')}
      </tbody></table></div>`;
    main.querySelectorAll<HTMLElement>('[data-sc]').forEach((b) =>
      b.addEventListener('click', () => {
        d.createScenario(b.dataset.sc!);
        tab = 'tickets';
        render();
      }),
    );
  };

  let adEl: HTMLElement | null = null;
  const render = () => {
    renderSide();
    if (tab !== 'ad') adEl = null;
    if (tab === 'tickets') {
      const t = current !== null ? d.tickets.get(current) : undefined;
      if (t) renderTicket(t);
      else renderTickets();
    } else if (tab === 'ad') {
      main.innerHTML = header('Annuaire › Utilisateurs et ordinateurs Active Directory');
      adEl ??= buildAdConsole(d.office, (text, kind) => d.toast(text, kind));
      main.append(adEl);
    } else if (tab === 'parc') renderParc();
    else if (tab === 'prets') renderPrets();
    else if (tab === 'ssh') renderSsh();
    else if (tab === 'kb') renderKb();
    else if (tab === 'stats') renderStats();
    else renderSandbox();
  };

  // Mise à jour en temps réel quand un ticket arrive / change (sauf pendant la saisie).
  const off = d.tickets.onEvent(() => {
    if (!root.isConnected) return off();
    const typing = root.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement!.tagName);
    if (tab === 'tickets' && !typing) render();
    else renderSide();
  });
  render();
  return root;
}

export { getScenario, DESKS };
