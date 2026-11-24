/**
 * Poste utilisateur : bureau Windows simulé.
 * Écran de connexion (compte verrouillé, changement de mot de passe), invite de commandes,
 * paramètres réseau, Explorateur (lecteurs réseau), Outlook (profil, quota, boîtes partagées, phishing),
 * imprimantes (file d'attente, imprimante par défaut, page de test), gestionnaire de périphériques, redémarrage.
 */
import type { DeskDef } from '../data/map';
import type { Network } from '../network/Network';
import { passwordComplexityError, type Office } from '../sim/Office';
import { WindowsShell } from '../sim/WindowsShell';
import { formatTime } from '../state/clock';
import { el, escapeHtml } from '../ui/dom';
import { createTerminal, terminalStore } from './Terminal';

export interface DesktopDeps {
  office: Office;
  net: Network;
  desk: DeskDef | { id: string; pcName: string; userId: string | null };
  minutes: () => number;
  toast: (text: string, kind?: 'ok' | 'warn' | 'error' | 'info') => void;
  onReboot: (host: string) => void;
}

type AppId = 'cmd' | 'net' | 'explorer' | 'outlook' | 'printers' | 'devices';

const SHARE_FILES: Record<string, string[]> = {
  Commun: ['📁 Notes de service', '📁 Modèles Word', '📄 Charte informatique.pdf', '📄 Planning congés 2026.xlsx'],
  Compta: ['📁 Clôture 2026', '📁 Factures fournisseurs', '📁 Banque', '📄 Grand livre.xlsx', '📄 TVA T3.xlsx'],
  Commercial: ['📁 Devis', '📁 Clients', '📄 Tarifs 2026.pdf', '📄 Pipeline.xlsx'],
  Direction: ['📁 CODIR', '📁 Budget', '📄 Stratégie 2027.pptx'],
  RH: ['📁 Dossiers salariés', '📁 Recrutement', '📄 Organigramme.pdf'],
  Juridique: ['📁 Contrats', '📁 Contentieux', '📄 CGV.docx'],
};

const PHISH_CLUES: { id: string; label: string; real: boolean }[] = [
  { id: 'domain', label: 'L’adresse de l’expéditeur n’est pas celle de la vraie banque', real: true },
  { id: 'urgency', label: 'Le ton est urgent et menaçant (« sous 24h »)', real: true },
  { id: 'link', label: 'Le lien pointe vers un site inconnu', real: true },
  { id: 'credentials', label: 'On demande des identifiants par mail', real: true },
  { id: 'hour', label: 'Le mail est arrivé le matin', real: false },
  { id: 'polite', label: 'Le mail commence par « Cher client »', real: false },
];

export function buildUserDesktop(d: DesktopDeps): HTMLElement {
  const host = d.desk.pcName;
  const root = el('div', { class: 'win-root' });
  let app: AppId | null = null;
  let loginMode: 'tile' | 'other' | 'change' = 'tile';
  let selectedMail: string | null = null;
  let explorerPath: string | null = null;
  let queueOpen: string | null = null;
  const shell = new WindowsShell(d.office, host);
  let term: ReturnType<typeof createTerminal> | null = null;

  const pc = () => d.office.pc(host)!;
  const user = () => d.office.user(pc().user);

  const render = () => {
    const p = pc();
    if (p.rebootUntil !== null) return renderBoot();
    const u = user();
    if (!u || u.locked || !u.enabled || loginMode === 'change' || loginMode === 'other') return renderLogin();
    renderDesktop();
  };

  // ------------------------------------------------------------------ écrans de démarrage / connexion
  const renderBoot = () => {
    root.innerHTML = `<div class="win-boot"><div class="win-logo">⊞</div><div class="spinner"></div><p>Redémarrage…</p></div>`;
    const t = setInterval(() => {
      if (!root.isConnected) return clearInterval(t);
      if (pc().rebootUntil === null) {
        clearInterval(t);
        term = null;
        render();
      }
    }, 300);
  };

  const renderLogin = () => {
    const p = pc();
    const u = user();
    let body: string;
    if (loginMode === 'change' && u) {
      body = `<div class="win-avatar">${escapeHtml(u.firstName[0] + u.lastName[0])}</div><h3>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</h3>
        <p>Vous devez changer votre mot de passe avant de vous connecter.</p>
        <input type="password" id="w-np1" placeholder="Nouveau mot de passe"><input type="password" id="w-np2" placeholder="Confirmer le mot de passe">
        <button class="wbtn" data-act="change">→</button>`;
    } else if (loginMode === 'other' || !u) {
      body = `<div class="win-avatar">👤</div><h3>Autre utilisateur</h3>
        <input id="w-login" placeholder="Nom d’utilisateur (ex. lbernard)" autocapitalize="off"><input type="password" id="w-pw" placeholder="Mot de passe">
        <button class="wbtn" data-act="logon">→</button><p class="muted">Domaine : ENTREPRISE</p>
        ${u ? '<button class="link-btn light" data-act="tile">← Retour</button>' : ''}`;
    } else {
      const err = u.locked
        ? 'Le compte référencé est actuellement verrouillé et vous ne pourrez peut-être pas vous y connecter.'
        : !u.enabled
          ? 'Votre compte a été désactivé. Contactez votre administrateur système.'
          : '';
      body = `<div class="win-avatar">${escapeHtml(u.firstName[0] + u.lastName[0])}</div><h3>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</h3>
        ${err ? `<div class="win-err">${err}</div>` : ''}
        <button class="wbtn" data-act="retry">Réessayer</button>
        <button class="link-btn light" data-act="other">Autre utilisateur</button>`;
    }
    root.innerHTML = `<div class="win-login"><div class="win-login-clock">${formatTime(d.minutes())}</div><div class="win-login-box">${body}</div><div class="win-login-pc">${host}</div></div>`;
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s);
    root.querySelectorAll<HTMLElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'other') loginMode = 'other';
        else if (act === 'tile') loginMode = 'tile';
        else if (act === 'retry') loginMode = 'tile';
        else if (act === 'logon') {
          const login = q<HTMLInputElement>('#w-login')!.value.trim().toLowerCase();
          if (!login || !q<HTMLInputElement>('#w-pw')!.value) return d.toast('Saisissez un nom d’utilisateur et un mot de passe.', 'warn');
          const err = d.office.logon(host, login);
          if (err) return d.toast(err, 'error');
          loginMode = d.office.user(login)?.mustChangePassword ? 'change' : 'tile';
        } else if (act === 'change') {
          const a = q<HTMLInputElement>('#w-np1')!.value;
          if (a !== q<HTMLInputElement>('#w-np2')!.value) return d.toast('Les mots de passe ne correspondent pas.', 'error');
          const err = passwordComplexityError(a);
          if (err) return d.toast(err, 'error');
          const u = user()!;
          u.mustChangePassword = false;
          d.office.changed();
          d.toast('Votre mot de passe a été modifié.', 'ok');
          loginMode = 'tile';
        }
        render();
      }),
    );
    void p;
  };

  // ------------------------------------------------------------------ bureau
  const icons: [AppId | 'reboot' | 'logoff', string, string][] = [
    ['cmd', '⬛', 'Invite de commandes'],
    ['net', '🌐', 'Paramètres réseau'],
    ['explorer', '📁', 'Explorateur'],
    ['outlook', '📧', 'Outlook'],
    ['printers', '🖨️', 'Imprimantes'],
    ['devices', '🧩', 'Gestionnaire de périphériques'],
    ['reboot', '🔄', 'Redémarrer'],
    ['logoff', '🚪', 'Fermer la session'],
  ];

  const netIcon = () => {
    const ip = d.net.hostIp(host);
    if (pc().released) return '🌐❌';
    return ip.status === 'dhcp' || ip.status === 'static' ? '🖧' : ip.status === 'apipa' ? '🖧⚠️' : '🌐❌';
  };

  const renderDesktop = () => {
    const u = user()!;
    root.innerHTML = `<div class="win-desktop">
      <div class="win-icons">${icons.map(([id, ic, label]) => `<div class="win-icon" data-open="${id}">${ic}<span>${label}</span></div>`).join('')}</div>
      <div class="win-app-area"></div>
      <div class="win-taskbar"><span class="win-start">⊞</span><span class="win-search">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)} — ${host}</span><span class="win-tray" title="État du réseau">${netIcon()}</span><span class="win-clock">${formatTime(d.minutes())}</span></div>
    </div>`;
    root.querySelectorAll<HTMLElement>('[data-open]').forEach((n) =>
      n.addEventListener('click', () => {
        const id = n.dataset.open!;
        if (id === 'reboot') {
          d.office.reboot(host, Date.now());
          d.onReboot(host);
          app = null;
          term = null;
          return render();
        }
        if (id === 'logoff') {
          // Fermer / rouvrir la session : le jeton de groupes est relu.
          const login = pc().user!;
          pc().user = null;
          const err = d.office.logon(host, login);
          d.toast(err ?? `Session de ${login} rouverte (groupes et lecteurs réseau actualisés).`, err ? 'error' : 'ok');
          return render();
        }
        app = id as AppId;
        renderApp();
      }),
    );
    renderApp();
  };

  const win = (title: string, body: string, wide = false) =>
    `<div class="win-window${wide ? ' wide' : ''}"><div class="win-title"><span>${title}</span><button class="win-x" data-act="close-app">✕</button></div><div class="win-body">${body}</div></div>`;

  const renderApp = () => {
    const area = root.querySelector('.win-app-area');
    if (!area) return;
    const tray = root.querySelector('.win-tray');
    if (tray) tray.textContent = netIcon();
    if (!app) {
      area.innerHTML = '';
      return;
    }
    if (app === 'cmd') {
      area.innerHTML = win('Invite de commandes', '<div class="cmd-host"></div>', true);
      term ??= createTerminal(
        {
          theme: 'cmd',
          store: terminalStore(`cmd:${host}`),
          banner: 'Microsoft Windows [version 10.0.19045.4529]\n(c) Microsoft Corporation. Tous droits réservés.\n',
          prompt: () => shell.prompt,
          exec: (line) => {
            const r = shell.exec(line);
            if (r.reboot) {
              d.office.reboot(host, Date.now());
              d.onReboot(host);
              setTimeout(() => {
                app = null;
                term = null;
                render();
              }, 400);
            }
            if (r.exit) setTimeout(() => {
              app = null;
              term = null;
              renderApp();
            }, 50);
            setTimeout(() => {
              const t = root.querySelector('.win-tray');
              if (t) t.textContent = netIcon();
            }, 0);
            return { out: r.out, clear: r.clear };
          },
        },
      );
      area.querySelector('.cmd-host')!.append(term.root);
      term.focus();
    } else if (app === 'net') area.innerHTML = win('Paramètres réseau — Ethernet', netSettings());
    else if (app === 'explorer') area.innerHTML = win('Explorateur de fichiers', explorer(), true);
    else if (app === 'outlook') area.innerHTML = win('Outlook', outlook(), true);
    else if (app === 'printers') area.innerHTML = win('Imprimantes et scanners', printers(), true);
    else if (app === 'devices') area.innerHTML = win('Gestionnaire de périphériques', devices());
    area.querySelector('[data-act="close-app"]')?.addEventListener('click', () => {
      app = null;
      term = null;
      renderApp();
    });
    bindApp(area as HTMLElement);
  };

  // ------------------------------------------------------------------ applications
  const netSettings = () => {
    const h = d.net.host(host)!;
    const ip = d.net.hostIp(host);
    const st: Record<string, string> = {
      dhcp: '✅ Connecté — Réseau du domaine (entreprise.local)',
      static: '✅ Connecté (adresse IP fixe)',
      apipa: '⚠️ Réseau non identifié — Pas d’accès Internet',
      disconnected: '❌ Câble réseau débranché',
      disabled: '⛔ Carte désactivée',
      off: '',
    };
    return `<div class="netset">
      <div class="netset-head"><b>Ethernet</b> — Intel(R) Ethernet Connection I219-LM<br><span>${pc().released ? '❌ Adresse libérée (ipconfig /release)' : st[ip.status]}</span></div>
      <button class="wbtn2" data-act="nic">${h.nicEnabled ? 'Désactiver la carte réseau' : 'Activer la carte réseau'}</button>
      <fieldset><legend>Propriétés de : Protocole Internet version 4 (TCP/IPv4)</legend>
        <label class="chk"><input type="radio" name="ipmode" value="dhcp" ${h.ip.mode === 'dhcp' ? 'checked' : ''}> Obtenir une adresse IP automatiquement</label>
        <label class="chk"><input type="radio" name="ipmode" value="static" ${h.ip.mode === 'static' ? 'checked' : ''}> Utiliser l’adresse IP suivante :</label>
        <div class="ipgrid">
          <label>Adresse IP<input id="ip-ip" value="${escapeHtml(h.ip.ip)}"></label>
          <label>Masque de sous-réseau<input id="ip-mask" value="${escapeHtml(h.ip.mask || '255.255.255.0')}"></label>
          <label>Passerelle par défaut<input id="ip-gw" value="${escapeHtml(h.ip.gateway)}"></label>
          <label>Serveur DNS préféré<input id="ip-dns" value="${escapeHtml(h.ip.dns)}"></label>
        </div>
        <button class="wbtn2 primary" data-act="ip-ok">OK</button>
      </fieldset></div>`;
  };

  const explorer = () => {
    const p = pc();
    if (explorerPath) {
      const code = d.office.shareAccess(host, explorerPath);
      const name = explorerPath.split('\\').pop() ?? '';
      const body =
        code === 0
          ? `<ul class="files">${(SHARE_FILES[name] ?? ['📄 Lisez-moi.txt']).map((f) => `<li>${f}</li>`).join('')}</ul>`
          : `<div class="win-dialog-err">❌ <b>${escapeHtml(explorerPath)}</b><br>${code === 5 ? 'Vous n’avez pas l’autorisation d’accéder à cette ressource. Contactez votre administrateur réseau pour obtenir l’accès.' : 'Windows ne peut pas accéder à ce chemin. Vérifiez l’orthographe du nom. Sinon, il y a peut-être un problème avec votre réseau.'}<br><small>Code d’erreur : 0x${code === 5 ? '80070005' : '80070035'}</small></div>`;
      return `<div class="addr"><button class="wbtn2" data-act="exp-up">↑</button><input id="exp-path" value="${escapeHtml(explorerPath)}"><button class="wbtn2" data-act="exp-go">→</button></div>${body}`;
    }
    const drives = [`<li data-drive="C:">💽 Disque local (C:)</li>`, ...p.drives.map((dr) => `<li data-path="${escapeHtml(dr.path)}">🗄️ ${escapeHtml(dr.path.split('\\').pop() ?? '')} (${escapeHtml(dr.path.replace(/^\\\\/, '\\\\'))}) (${dr.letter})</li>`)];
    return `<div class="addr"><span>Ce PC</span><input id="exp-path" placeholder="Tapez un chemin, ex. \\\\SRV-FICHIERS\\Compta"><button class="wbtn2" data-act="exp-go">→</button></div>
      <h4>Périphériques et lecteurs</h4><ul class="files drives">${drives.join('')}</ul>
      <p class="muted">Lecteurs réseau connectés : ${p.drives.length ? p.drives.map((x) => x.letter).join(', ') : 'aucun'}</p>`;
  };

  const outlook = () => {
    const o = pc().outlook;
    if (o.profileCorrupt) {
      return `<div class="win-dialog-err">❌ <b>Impossible de démarrer Microsoft Outlook.</b><br>Impossible d’ouvrir la fenêtre Outlook. Le jeu de dossiers ne peut pas être ouvert. Le fichier ost n’est pas un fichier de dossiers personnels.</div>
        <h4>Panneau de configuration › Courrier › Profils</h4>
        <p>Profil actuel : <b>Outlook</b> (endommagé)</p>
        <button class="wbtn2 primary" data-act="new-profile">Ajouter un nouveau profil et le définir par défaut</button>`;
    }
    const mails = o.mails.filter((m) => !o.blocked.includes(m.from) || m.phishing);
    const m = mails.find((x) => x.id === selectedMail) ?? null;
    const full = o.mailboxUsage >= 90;
    return `<div class="ol">
      <div class="ol-side"><div class="ol-acc">📮 ${escapeHtml(pc().user ?? '')}@entreprise.fr</div><div class="ol-f on">Boîte de réception</div><div class="ol-f">Éléments envoyés</div><div class="ol-f">Éléments supprimés</div>
        ${o.shared.map((s) => `<div class="ol-acc">📬 ${escapeHtml(s)}</div><div class="ol-f">Boîte de réception</div>`).join('')}
        <div class="quota ${full ? 'full' : ''}"><div style="width:${o.mailboxUsage}%"></div></div><small>${o.mailboxUsage} % de 2 Go utilisés</small>
        <button class="wbtn2 small" data-act="archive">🗃️ Archiver / nettoyer</button>
        <button class="wbtn2 small" data-act="add-shared">➕ Ajouter une boîte partagée</button>
        <div class="add-shared hidden"><input id="shared-addr" placeholder="ex. commercial@entreprise.fr"><button class="wbtn2 small" data-act="do-shared">OK</button></div>
      </div>
      <div class="ol-list">${full ? '<div class="ol-banner">⚠️ Votre boîte aux lettres est pleine. Vous ne pouvez plus envoyer ni recevoir de messages.</div>' : ''}
        ${mails.map((x) => `<div class="ol-mail${x.id === selectedMail ? ' on' : ''}" data-mail="${x.id}"><b>${escapeHtml(x.from)}</b><span>${escapeHtml(x.subject)}</span><small>${escapeHtml(x.date)}${x.phishing?.reported ? ' · signalé' : ''}</small></div>`).join('')}
      </div>
      <div class="ol-read">${
        m
          ? `<h3>${escapeHtml(m.subject)}</h3><div class="ol-from">De : <b>${escapeHtml(m.from)}</b> · ${escapeHtml(m.date)}</div>
          <div class="ol-actions"><button class="wbtn2 small" data-act="report">🎣 Signaler comme hameçonnage</button><button class="wbtn2 small" data-act="block">⛔ Bloquer l’expéditeur</button><button class="wbtn2 small" data-act="delete">🗑️ Supprimer</button></div>
          <div class="ol-body">${escapeHtml(m.body)
            .replace(/\n/g, '<br>')
            .replace(/(http:\/\/\S+)/, '<a href="#" class="phish-link" data-act="click-link">$1</a>')}</div>
          <div class="phish-quiz hidden"><b>Quels indices montrent que c’est un hameçonnage ?</b>${PHISH_CLUES.map((c) => `<label class="chk"><input type="checkbox" data-clue="${c.id}"> ${c.label}</label>`).join('')}<button class="wbtn2 primary small" data-act="do-report">Envoyer le signalement</button></div>`
          : '<p class="muted">Sélectionnez un message.</p>'
      }</div></div>`;
  };

  const printers = () => {
    const p = pc();
    const list = p.printers
      .map((id) => {
        const pr = d.office.state.printers[id];
        const name = pr?.name ?? id;
        const status = pr ? (d.office.printProblems(host, id).length ? '⚠️ ' + d.office.printProblems(host, id)[0] : '✅ Prête') : '✅ Prête';
        return `<div class="prn${p.defaultPrinter === id ? ' def' : ''}"><div><b>🖨️ ${escapeHtml(name)}</b>${p.defaultPrinter === id ? ' <span class="pill green">Par défaut</span>' : ''}<br><small>${escapeHtml(status)}${pr ? ` · Toner ${pr.toner} %` : ''}</small></div>
        <div class="prn-act">${p.defaultPrinter !== id ? `<button class="wbtn2 small" data-default="${id}">Définir par défaut</button>` : ''}${pr ? `<button class="wbtn2 small" data-queue="${id}">File d’attente</button><button class="wbtn2 small" data-test="${id}">Page de test</button>` : ''}</div></div>`;
      })
      .join('');
    let queue = '';
    if (queueOpen) {
      const pr = d.office.state.printers[queueOpen];
      queue = `<h4>File d’attente — ${escapeHtml(pr.name)}</h4><table class="wtable"><tr><th>Document</th><th>Propriétaire</th><th>Statut</th></tr>${pr.queue.map((j) => `<tr><td>${escapeHtml(j.doc)}</td><td>${escapeHtml(j.owner)}</td><td class="${j.status.startsWith('Erreur') ? 'red-t' : ''}">${j.status}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucun document.</td></tr>'}</table>
        <button class="wbtn2" data-act="purge">Imprimante › Annuler tous les documents</button>`;
    }
    return `${list}${queue}`;
  };

  const devices = () => {
    const p = pc();
    const h = d.net.host(host)!;
    return `<ul class="devtree">
      <li>💻 ${host}<ul>
        <li>🖥️ Cartes graphiques<ul><li>${p.displayDriverOk ? 'Intel(R) UHD Graphics 630' : '⚠️ Carte vidéo de base Microsoft (pilote manquant) <button class="link-btn" data-act="driver">Mettre à jour le pilote</button>'}</li></ul></li>
        <li>🌐 Cartes réseau<ul><li>${h.nicEnabled ? 'Intel(R) Ethernet Connection I219-LM' : '⬇️ Intel(R) Ethernet Connection I219-LM (désactivé) <button class="link-btn" data-act="nic">Activer le périphérique</button>'}</li></ul></li>
        <li>🖵 Moniteurs<ul>${p.videoCable && !p.monitorDead ? '<li>Moniteur PnP générique (Dell P2422H)</li>' : '<li class="muted">Aucun moniteur détecté</li>'}</ul></li>
        <li>🧠 Mémoire<ul><li>${p.ramGb} Go DDR4 ${p.ramGb < 8 ? '<span class="orange-t">(insuffisant pour Windows 10 + Office + Teams)</span>' : ''}</li></ul></li>
        <li>⌨️ Claviers<ul><li>Périphérique clavier PS/2 standard</li></ul></li>
      </ul></li></ul>`;
  };

  // ------------------------------------------------------------------ actions des applications
  const bindApp = (area: HTMLElement) => {
    const q = <T extends HTMLElement>(s: string) => area.querySelector<T>(s);
    const refresh = () => renderApp();
    area.querySelectorAll<HTMLElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        const act = b.dataset.act;
        const p = pc();
        const o = p.outlook;
        switch (act) {
          case 'nic': {
            const h = d.net.host(host)!;
            h.nicEnabled = !h.nicEnabled;
            d.net.changed();
            break;
          }
          case 'ip-ok': {
            const h = d.net.host(host)!;
            const mode = q<HTMLInputElement>('input[name="ipmode"]:checked')!.value as 'dhcp' | 'static';
            if (mode === 'dhcp') h.ip = { mode: 'dhcp', ip: '', mask: '', gateway: '', dns: '' };
            else {
              const v = (id: string) => q<HTMLInputElement>(id)!.value.trim();
              if (!/^\d+\.\d+\.\d+\.\d+$/.test(v('#ip-ip')) || !/^\d+\.\d+\.\d+\.\d+$/.test(v('#ip-mask'))) return d.toast('Adresse IP ou masque invalide.', 'error');
              h.ip = { mode: 'static', ip: v('#ip-ip'), mask: v('#ip-mask'), gateway: v('#ip-gw'), dns: v('#ip-dns') };
            }
            p.released = false;
            d.net.changed();
            d.toast('Paramètres IPv4 enregistrés.', 'ok');
            break;
          }
          case 'exp-go': {
            const v = q<HTMLInputElement>('#exp-path')!.value.trim();
            if (v) explorerPath = v.replace(/\//g, '\\');
            break;
          }
          case 'exp-up':
            explorerPath = null;
            break;
          case 'new-profile':
            o.profileCorrupt = false;
            d.office.changed();
            d.toast('Nouveau profil Outlook créé : la boîte Exchange se synchronise…', 'ok');
            break;
          case 'archive':
            o.mailboxUsage = Math.min(o.mailboxUsage, 48);
            d.office.changed();
            d.toast('Anciens éléments archivés, éléments supprimés vidés.', 'ok');
            break;
          case 'add-shared':
            q('.add-shared')?.classList.toggle('hidden');
            return;
          case 'do-shared': {
            const addr = q<HTMLInputElement>('#shared-addr')!.value.trim().toLowerCase();
            const groups: Record<string, string> = { 'commercial@entreprise.fr': 'GG_BAL_Commercial', 'compta@entreprise.fr': 'GG_BAL_Compta' };
            const g = groups[addr];
            if (!g) return d.toast('Impossible de trouver cette boîte aux lettres dans l’annuaire.', 'error');
            if (!d.office.user(p.user)?.groups.includes(g)) return d.toast('Impossible d’ouvrir ce jeu de dossiers : vous n’avez pas l’autorisation d’ouvrir cette boîte aux lettres.', 'error');
            if (!o.shared.includes(addr)) o.shared.push(addr);
            d.office.changed();
            d.toast(`Boîte partagée ${addr} ajoutée.`, 'ok');
            break;
          }
          case 'report': {
            const m = o.mails.find((x) => x.id === selectedMail);
            if (m?.phishing) {
              q('.phish-quiz')?.classList.remove('hidden');
              return;
            }
            d.toast('Message signalé à l’équipe sécurité. (Ce n’était pas un hameçonnage.)', 'info');
            return;
          }
          case 'do-report': {
            const m = o.mails.find((x) => x.id === selectedMail);
            if (!m?.phishing) return;
            const checked = [...area.querySelectorAll<HTMLInputElement>('[data-clue]')].filter((c) => c.checked).map((c) => c.dataset.clue!);
            const good = checked.filter((c) => PHISH_CLUES.find((x) => x.id === c)?.real).length;
            const bad = checked.length - good;
            m.phishing.reported = true;
            d.office.state.flags.phishClues = Math.max(0, good - bad);
            d.office.changed();
            d.toast(`Hameçonnage signalé. Indices repérés : ${good}/4${bad ? ` (${bad} fausse(s) piste(s))` : ''}.`, good >= 3 && !bad ? 'ok' : 'info');
            break;
          }
          case 'block': {
            const m = o.mails.find((x) => x.id === selectedMail);
            if (m && !o.blocked.includes(m.from)) o.blocked.push(m.from);
            d.office.changed();
            d.toast(`Expéditeur ${m?.from} bloqué.`, 'ok');
            break;
          }
          case 'delete':
            o.mails = o.mails.filter((x) => x.id !== selectedMail || x.phishing);
            if (o.mails.find((x) => x.id === selectedMail)?.phishing) d.toast('Supprimé… mais pensez aussi à le signaler et à bloquer l’expéditeur !', 'warn');
            selectedMail = null;
            d.office.changed();
            break;
          case 'click-link': {
            const m = o.mails.find((x) => x.id === selectedMail);
            if (m?.phishing) {
              m.phishing.clicked = true;
              const u = d.office.user(p.user);
              if (u) u.compromised = true;
              d.office.changed();
              d.toast('⚠️ Vous avez cliqué sur le lien de phishing ! Le compte est potentiellement compromis : réinitialisez son mot de passe dans l’AD.', 'error');
            }
            break;
          }
          case 'purge':
            if (queueOpen) d.office.purgeQueue(queueOpen);
            d.toast('Tous les documents ont été annulés.', 'ok');
            break;
          case 'driver':
            if (!d.office.dcReachable(host)) return d.toast('Windows n’a pas pu trouver de pilote : vérifiez la connexion réseau (ou utilisez la clé USB).', 'error');
            p.displayDriverOk = true;
            d.office.changed();
            d.toast('Pilote Intel(R) UHD Graphics installé.', 'ok');
            break;
        }
        refresh();
      }),
    );
    area.querySelectorAll<HTMLElement>('[data-path]').forEach((n) =>
      n.addEventListener('click', () => {
        explorerPath = n.dataset.path!;
        refresh();
      }),
    );
    area.querySelectorAll<HTMLElement>('[data-mail]').forEach((n) =>
      n.addEventListener('click', () => {
        selectedMail = n.dataset.mail!;
        refresh();
      }),
    );
    area.querySelectorAll<HTMLElement>('[data-default]').forEach((n) =>
      n.addEventListener('click', () => {
        pc().defaultPrinter = n.dataset.default!;
        d.office.changed();
        refresh();
      }),
    );
    area.querySelectorAll<HTMLElement>('[data-queue]').forEach((n) =>
      n.addEventListener('click', () => {
        queueOpen = queueOpen === n.dataset.queue ? null : n.dataset.queue!;
        refresh();
      }),
    );
    area.querySelectorAll<HTMLElement>('[data-test]').forEach((n) =>
      n.addEventListener('click', () => {
        const id = n.dataset.test!;
        const pr = d.office.state.printers[id];
        const problems = d.office.printProblems(host, id);
        if (problems.length) {
          if (!pr.stuck) pr.queue.push({ doc: 'Page de test', owner: pc().user ?? '', status: 'Erreur - Impression' });
          d.toast(`Échec de l’impression sur ${pr.name} : ${problems.join(', ')}.`, 'error');
        } else d.toast(`Page de test imprimée sur ${pr.name} ✔`, 'ok');
        d.office.changed();
        refresh();
      }),
    );
  };

  render();
  return root;
}
