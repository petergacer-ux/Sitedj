/**
 * Console « Utilisateurs et ordinateurs Active Directory » simplifiée :
 * recherche, déverrouillage, réinitialisation de mot de passe, activation/désactivation,
 * appartenance aux groupes, création d'un compte pour un nouvel arrivant.
 */
import { makeLogin, serviceGroup, type Office } from '../sim/Office';
import type { AdUser } from '../sim/types';
import { el, escapeHtml } from '../ui/dom';

const SERVICES = ['Compta', 'Commercial', 'Direction', 'RH', 'Juridique', 'Informatique'];

export function buildAdConsole(office: Office, toast: (t: string, k?: 'ok' | 'warn' | 'error' | 'info') => void): HTMLElement {
  const root = el('div', { class: 'adc' });
  let selected: string | null = null;
  let filter = '';
  let ou = 'Tous';
  let creating = false;

  const render = () => {
    const users = Object.values(office.state.ad.users)
      .filter((u) => ou === 'Tous' || u.service === ou)
      .filter((u) => !filter || `${u.firstName} ${u.lastName} ${u.login}`.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
    const state = (u: AdUser) =>
      !u.enabled ? '<span class="pill grey">Désactivé</span>' : u.locked ? '<span class="pill red">🔒 Verrouillé</span>' : '<span class="pill green">Actif</span>';
    root.innerHTML = `
      <div class="adc-tree">
        <div class="adc-domain">🌐 ${escapeHtml(office.state.ad.domain)}</div>
        ${['Tous', ...SERVICES].map((s) => `<div class="adc-ou${s === ou ? ' on' : ''}" data-ou="${s}">📁 ${s === 'Tous' ? 'Utilisateurs (tous)' : `OU=${s}`}</div>`).join('')}
        <div class="adc-ou" data-ou="__groups">👥 Groupes</div>
      </div>
      <div class="adc-main">
        <div class="adc-toolbar">
          <input class="adc-search" id="adc-search" placeholder="Rechercher un nom ou un login…" value="${escapeHtml(filter)}">
          <button class="gbtn primary" data-act="new">➕ Nouvel utilisateur</button>
        </div>
        ${
          ou === '__groups'
            ? groupsView()
            : `<table class="gtable adc-table"><thead><tr><th>Nom</th><th>Ouverture de session</th><th>Service</th><th>État</th></tr></thead><tbody>
          ${users.map((u) => `<tr data-user="${u.login}" class="${u.login === selected ? 'sel' : ''}"><td>👤 ${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</td><td>${escapeHtml(u.login)}</td><td>${escapeHtml(u.service)}</td><td>${state(u)}</td></tr>`).join('')}
          </tbody></table>`
        }
      </div>
      <div class="adc-detail">${creating ? createForm() : selected ? detail(office.user(selected)!) : '<p class="muted">Sélectionnez un utilisateur.</p>'}</div>`;
    bind();
  };

  const groupsView = () => {
    const groups = Object.values(office.state.ad.groups);
    return `<table class="gtable"><thead><tr><th>Groupe</th><th>Description</th><th>Membres</th></tr></thead><tbody>
      ${groups
        .map((g) => {
          const members = Object.values(office.state.ad.users).filter((u) => u.groups.includes(g.name)).length;
          return `<tr><td>👥 ${g.name}</td><td>${escapeHtml(g.description)}</td><td>${members}</td></tr>`;
        })
        .join('')}</tbody></table>`;
  };

  const detail = (u: AdUser) => {
    const missing = Object.keys(office.state.ad.groups).filter((g) => !u.groups.includes(g));
    return `
      <h3>👤 ${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</h3>
      <div class="adc-props">
        <div><span>Ouverture de session</span><b>${escapeHtml(u.login)}@entreprise.local</b></div>
        <div><span>Service</span><b>${escapeHtml(u.service)}</b></div>
        <div><span>Compte</span><b>${u.enabled ? 'Activé' : 'Désactivé'}${u.locked ? ' — <span class="red-t">verrouillé</span>' : ''}</b></div>
        <div><span>Mot de passe</span><b>${u.passwordExpired ? '<span class="red-t">expiré</span>' : u.mustChangePassword ? 'à changer à la prochaine ouverture' : 'OK'}</b></div>
      </div>
      <div class="adc-actions">
        ${u.locked ? '<button class="gbtn primary" data-act="unlock">🔓 Déverrouiller le compte</button>' : ''}
        <button class="gbtn" data-act="reset">🔑 Réinitialiser le mot de passe…</button>
        <button class="gbtn" data-act="toggle">${u.enabled ? '⛔ Désactiver le compte' : '✅ Activer le compte'}</button>
      </div>
      <div class="adc-reset hidden">
        <label>Nouveau mot de passe<input type="password" id="adc-pw1" autocomplete="new-password"></label>
        <label>Confirmer<input type="password" id="adc-pw2" autocomplete="new-password"></label>
        <label class="chk"><input type="checkbox" id="adc-must" checked> L’utilisateur doit changer le mot de passe à la prochaine ouverture de session</label>
        <label class="chk"><input type="checkbox" id="adc-unlock" checked> Déverrouiller le compte de l’utilisateur</label>
        <button class="gbtn primary" data-act="do-reset">OK</button>
        <p class="muted">Stratégie du domaine : 8 caractères minimum, avec majuscule, minuscule et chiffre.</p>
      </div>
      <h4>Membre de</h4>
      <ul class="adc-groups">${u.groups.map((g) => `<li>👥 ${g} <button class="link-btn" data-remove="${g}">Supprimer</button></li>`).join('') || '<li class="muted">Aucun groupe</li>'}</ul>
      <div class="adc-add"><select id="adc-group">${missing.map((g) => `<option>${g}</option>`).join('')}</select><button class="gbtn" data-act="add-group">Ajouter</button></div>`;
  };

  const createForm = () => `
    <h3>➕ Nouvel objet – Utilisateur</h3>
    <div class="adc-form">
      <label>Prénom<input id="nu-first"></label>
      <label>Nom<input id="nu-last"></label>
      <label>Nom d’ouverture de session<input id="nu-login" placeholder="auto : initiale + nom"></label>
      <label>Service<select id="nu-service">${SERVICES.map((s) => `<option>${s}</option>`).join('')}</select></label>
      <label>Mot de passe<input type="password" id="nu-pw" autocomplete="new-password"></label>
      <label class="chk"><input type="checkbox" id="nu-must" checked> L’utilisateur doit changer le mot de passe à la prochaine ouverture de session</label>
      <div class="adc-groupchecks">${Object.keys(office.state.ad.groups)
        .map((g) => `<label class="chk"><input type="checkbox" data-g="${g}" ${g === 'GG_Utilisateurs' ? 'checked' : ''}> ${g}</label>`)
        .join('')}</div>
      <div class="adc-actions"><button class="gbtn primary" data-act="create">Créer</button><button class="gbtn" data-act="cancel">Annuler</button></div>
    </div>`;

  const bind = () => {
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s);
    q<HTMLInputElement>('#adc-search')?.addEventListener('input', (e) => {
      filter = (e.target as HTMLInputElement).value;
      const pos = (e.target as HTMLInputElement).selectionStart;
      render();
      const s = q<HTMLInputElement>('#adc-search')!;
      s.focus();
      s.setSelectionRange(pos, pos);
    });
    root.querySelectorAll<HTMLElement>('[data-ou]').forEach((n) =>
      n.addEventListener('click', () => {
        ou = n.dataset.ou!;
        render();
      }),
    );
    root.querySelectorAll<HTMLElement>('[data-user]').forEach((n) =>
      n.addEventListener('click', () => {
        selected = n.dataset.user!;
        creating = false;
        render();
      }),
    );
    root.querySelectorAll<HTMLElement>('[data-remove]').forEach((n) =>
      n.addEventListener('click', () => {
        office.removeFromGroup(selected!, n.dataset.remove!);
        toast(`${selected} retiré de ${n.dataset.remove}`, 'info');
        render();
      }),
    );
    const nuFirst = q<HTMLInputElement>('#nu-first');
    const nuLast = q<HTMLInputElement>('#nu-last');
    const nuLogin = q<HTMLInputElement>('#nu-login');
    const nuService = q<HTMLSelectElement>('#nu-service');
    const autoLogin = () => {
      if (nuLogin && nuFirst && nuLast) nuLogin.placeholder = makeLogin(nuFirst.value, nuLast.value) || 'auto : initiale + nom';
    };
    nuFirst?.addEventListener('input', autoLogin);
    nuLast?.addEventListener('input', autoLogin);
    nuService?.addEventListener('change', () => {
      const g = serviceGroup(nuService.value);
      root.querySelectorAll<HTMLInputElement>('[data-g]').forEach((c) => {
        if (c.dataset.g!.startsWith('GG_') && serviceGroup(c.dataset.g!.slice(3)) !== undefined) c.checked = c.dataset.g === g;
      });
    });
    root.querySelectorAll<HTMLElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'new') {
          creating = true;
          selected = null;
          render();
        } else if (act === 'cancel') {
          creating = false;
          render();
        } else if (act === 'create') {
          const groups = [...root.querySelectorAll<HTMLInputElement>('[data-g]')].filter((c) => c.checked).map((c) => c.dataset.g!);
          const r = office.createUser({
            firstName: nuFirst!.value,
            lastName: nuLast!.value,
            login: nuLogin!.value,
            service: nuService!.value,
            password: q<HTMLInputElement>('#nu-pw')!.value,
            mustChange: q<HTMLInputElement>('#nu-must')!.checked,
            groups,
          });
          if (typeof r === 'string') toast(r, 'error');
          else {
            toast(`Compte ${r.login} créé (${r.groups.join(', ')})`, 'ok');
            creating = false;
            selected = r.login;
            ou = 'Tous';
          }
          render();
        } else if (act === 'unlock') {
          office.unlock(selected!);
          toast(`Compte ${selected} déverrouillé`, 'ok');
          render();
        } else if (act === 'toggle') {
          const u = office.user(selected!)!;
          office.setEnabled(u.login, !u.enabled);
          toast(`Compte ${u.login} ${u.enabled ? 'activé' : 'désactivé'}`, 'info');
          render();
        } else if (act === 'reset') {
          q('.adc-reset')?.classList.toggle('hidden');
        } else if (act === 'do-reset') {
          const p1 = q<HTMLInputElement>('#adc-pw1')!.value;
          const p2 = q<HTMLInputElement>('#adc-pw2')!.value;
          if (p1 !== p2) return toast('Les mots de passe ne correspondent pas.', 'error');
          const err = office.resetPassword(selected!, p1, q<HTMLInputElement>('#adc-must')!.checked);
          if (err) return toast(err, 'error');
          if (q<HTMLInputElement>('#adc-unlock')!.checked) office.unlock(selected!);
          toast(`Le mot de passe de ${selected} a été modifié.`, 'ok');
          render();
        } else if (act === 'add-group') {
          const g = q<HTMLSelectElement>('#adc-group')!.value;
          if (!g) return;
          office.addToGroup(selected!, g);
          toast(`${selected} ajouté au groupe ${g}`, 'ok');
          render();
        }
      }),
    );
  };

  render();
  return root;
}
