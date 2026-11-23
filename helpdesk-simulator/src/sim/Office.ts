/**
 * L'entreprise côté « bureautique » : Active Directory, sessions Windows, partages réseau,
 * imprimantes, matériel et stock. S'appuie sur le moteur réseau pour tout ce qui est joignable ou non.
 * Module pur (pas de DOM ni de Three.js) → testable.
 */
import { DESKS, MY_DESK } from '../data/map';
import { USERS } from '../data/users';
import { macFor } from '../network/ip';
import type { Network } from '../network/Network';
import { ITEMS, ITEM_IDS } from './items';
import type { AdState, AdUser, ItemId, Mail, OfficeState, PcState, PrinterState } from './types';

export const DOMAIN = 'ENTREPRISE';
export const DC_IP = '192.168.99.10';

const SERVICE_GROUP: Record<string, string> = {
  Compta: 'GG_Compta',
  Commercial: 'GG_Commercial',
  Direction: 'GG_Direction',
  RH: 'GG_RH',
  Juridique: 'GG_Juridique',
};

export function serviceGroup(service: string): string | undefined {
  return SERVICE_GROUP[service];
}

/** Complexité de mot de passe de la stratégie de domaine : 8 caractères, majuscule, minuscule, chiffre. */
export function passwordComplexityError(pw: string): string | null {
  if (pw.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return 'Le mot de passe doit contenir une majuscule, une minuscule et un chiffre.';
  return null;
}

/** Login à la française : première lettre du prénom + nom, sans accents. */
export function makeLogin(first: string, last: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  return clean(first).slice(0, 1) + clean(last);
}

function defaultMails(first: string): Mail[] {
  return [
    { id: 'm1', from: 'bernard.durand@entreprise.fr', subject: 'Réunion de service jeudi', body: `Bonjour ${first},\n\nPetit rappel : réunion de service jeudi à 10h en salle de réunion.\n\nBernard`, date: 'Hier 16:42' },
    { id: 'm2', from: 'rh@entreprise.fr', subject: 'Tickets restaurant du mois', body: 'Les tickets restaurant sont disponibles à l’accueil.', date: 'Hier 11:05' },
  ];
}

export function createInitialOffice(): OfficeState {
  const ad: AdState = {
    domain: 'entreprise.local',
    users: {},
    groups: {
      GG_Utilisateurs: { name: 'GG_Utilisateurs', description: 'Tous les utilisateurs (lecteur P: Commun)' },
      GG_Compta: { name: 'GG_Compta', description: 'Service comptabilité (lecteur S: Compta)' },
      GG_Commercial: { name: 'GG_Commercial', description: 'Service commercial (lecteur S: Commercial)' },
      GG_Direction: { name: 'GG_Direction', description: 'Direction (lecteur S: Direction)' },
      GG_RH: { name: 'GG_RH', description: 'Ressources humaines (lecteur S: RH)' },
      GG_Juridique: { name: 'GG_Juridique', description: 'Service juridique (lecteur S: Juridique)' },
      GG_VPN: { name: 'GG_VPN', description: 'Accès VPN en télétravail' },
      GG_BAL_Compta: { name: 'GG_BAL_Compta', description: 'Accès à la boîte partagée compta@entreprise.fr' },
      GG_BAL_Commercial: { name: 'GG_BAL_Commercial', description: 'Accès à la boîte partagée commercial@entreprise.fr' },
      GG_Admins_Helpdesk: { name: 'GG_Admins_Helpdesk', description: 'Techniciens du support' },
    },
    shares: [
      { path: '\\\\SRV-FICHIERS\\Commun', group: 'GG_Utilisateurs', letter: 'P:' },
      { path: '\\\\SRV-FICHIERS\\Compta', group: 'GG_Compta', letter: 'S:' },
      { path: '\\\\SRV-FICHIERS\\Commercial', group: 'GG_Commercial', letter: 'S:' },
      { path: '\\\\SRV-FICHIERS\\Direction', group: 'GG_Direction', letter: 'S:' },
      { path: '\\\\SRV-FICHIERS\\RH', group: 'GG_RH', letter: 'S:' },
      { path: '\\\\SRV-FICHIERS\\Juridique', group: 'GG_Juridique', letter: 'S:' },
    ],
  };
  for (const u of USERS) {
    const groups = ['GG_Utilisateurs', SERVICE_GROUP[u.service]].filter(Boolean) as string[];
    if (u.service === 'Commercial' || u.service === 'Direction') groups.push('GG_VPN');
    if (u.service === 'Compta' && u.id !== 'slefevre') groups.push('GG_BAL_Compta');
    ad.users[u.id] = {
      login: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      service: u.service,
      enabled: true,
      locked: false,
      mustChangePassword: false,
      passwordExpired: false,
      groups,
      passwordResetAt: null,
    };
  }
  ad.users['tech.helpdesk'] = {
    login: 'tech.helpdesk',
    firstName: 'Technicien',
    lastName: 'Helpdesk',
    service: 'Informatique',
    enabled: true,
    locked: false,
    mustChangePassword: false,
    passwordExpired: false,
    groups: ['GG_Utilisateurs', 'GG_Admins_Helpdesk'],
    passwordResetAt: null,
  };

  const pcs: Record<string, PcState> = {};
  const mkPc = (host: string, login: string | null): PcState => {
    const user = login ? ad.users[login] : null;
    return {
      host,
      user: login,
      sessionGroups: user ? [...user.groups] : [],
      monitorOn: true,
      videoCable: true,
      monitorDead: false,
      powerCable: true,
      ramGb: 8,
      drives: user ? gpoDrives(ad, user.groups) : [],
      outlook: { profileCorrupt: false, mailboxUsage: 35 + (macFor(host).charCodeAt(10) % 30), shared: [], mails: user ? defaultMails(user.firstName) : [], blocked: [] },
      printers: ['IMP-COMPTA', 'Microsoft Print to PDF'],
      defaultPrinter: 'IMP-COMPTA',
      displayDriverOk: true,
      released: false,
      rebootUntil: null,
    };
  };
  for (const d of DESKS) pcs[d.pcName] = mkPc(d.pcName, d.userId);
  pcs[MY_DESK.pcName] = mkPc(MY_DESK.pcName, 'tech.helpdesk');
  // La direction a son imprimante USB personnelle
  pcs['PC-DIR-01'].printers.unshift('HP-DIR');
  pcs['PC-DIR-01'].defaultPrinter = 'HP-DIR';
  // Les comptables ont déjà la boîte partagée
  for (const d of DESKS.filter((x) => x.room === 'compta')) {
    if (d.userId && ad.users[d.userId].groups.includes('GG_BAL_Compta')) pcs[d.pcName].outlook.shared.push('compta@entreprise.fr');
  }

  const printers: Record<string, PrinterState> = {
    'IMP-COMPTA': { id: 'IMP-COMPTA', name: 'IMP-COMPTA (Ricoh MP 2555)', host: 'IMP-COMPTA', toner: 72, paperJam: false, queue: [], stuck: false },
    'HP-DIR': { id: 'HP-DIR', name: 'HP-DIR (HP LaserJet M404, USB)', host: null, toner: 64, paperJam: false, queue: [], stuck: false },
  };

  const stock = {} as Record<ItemId, number>;
  for (const id of ITEM_IDS) stock[id] = ITEMS[id].base;

  return { ad, pcs, printers, stock, inventory: Array(9).fill(null), loans: [], nextLoanId: 1, lastRestockDay: 1, flags: {} };
}

/** Lecteurs mappés par la GPO selon des groupes. */
export function gpoDrives(ad: AdState, groups: string[]): { letter: string; path: string }[] {
  const drives: { letter: string; path: string }[] = [];
  for (const s of ad.shares) {
    if (groups.includes(s.group) && !drives.some((d) => d.letter === s.letter)) drives.push({ letter: s.letter, path: s.path });
  }
  return drives;
}

export class Office {
  private listeners = new Set<() => void>();

  constructor(
    public net: Network,
    public state: OfficeState,
  ) {}

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed(): void {
    this.listeners.forEach((fn) => fn());
  }

  load(state: OfficeState): void {
    this.state = state;
    this.changed();
  }

  // ================================================================ annuaire

  user(login: string | null | undefined): AdUser | undefined {
    return login ? this.state.ad.users[login.toLowerCase()] : undefined;
  }

  pc(host: string): PcState | undefined {
    return this.state.pcs[host];
  }

  /** Poste habituel d'un utilisateur. */
  hostOf(login: string): string | undefined {
    return DESKS.find((d) => d.userId === login)?.pcName ?? Object.values(this.state.pcs).find((p) => p.user === login)?.host;
  }

  deskOf(login: string): string | undefined {
    return DESKS.find((d) => d.userId === login)?.id;
  }

  unlock(login: string): void {
    const u = this.user(login);
    if (u) u.locked = false;
    this.changed();
  }

  resetPassword(login: string, password: string, mustChange: boolean): string | null {
    const u = this.user(login);
    if (!u) return 'Utilisateur introuvable.';
    const err = passwordComplexityError(password);
    if (err) return err;
    u.mustChangePassword = mustChange;
    u.passwordExpired = false;
    u.passwordResetAt = Date.now();
    u.compromised = false;
    this.changed();
    return null;
  }

  setEnabled(login: string, enabled: boolean): void {
    const u = this.user(login);
    if (u) u.enabled = enabled;
    this.changed();
  }

  addToGroup(login: string, group: string): void {
    const u = this.user(login);
    if (u && this.state.ad.groups[group] && !u.groups.includes(group)) u.groups.push(group);
    this.changed();
  }

  removeFromGroup(login: string, group: string): void {
    const u = this.user(login);
    if (u) u.groups = u.groups.filter((g) => g !== group);
    this.changed();
  }

  createUser(opts: { firstName: string; lastName: string; service: string; login?: string; password: string; mustChange: boolean; groups: string[] }): AdUser | string {
    const login = (opts.login || makeLogin(opts.firstName, opts.lastName)).toLowerCase();
    if (!opts.firstName.trim() || !opts.lastName.trim()) return 'Le prénom et le nom sont obligatoires.';
    if (this.state.ad.users[login]) return `L’ouverture de session ${login} existe déjà dans le domaine.`;
    const err = passwordComplexityError(opts.password);
    if (err) return err;
    const u: AdUser = {
      login,
      firstName: opts.firstName.trim(),
      lastName: opts.lastName.trim(),
      service: opts.service,
      enabled: true,
      locked: false,
      mustChangePassword: opts.mustChange,
      passwordExpired: false,
      groups: [...new Set(opts.groups.filter((g) => this.state.ad.groups[g]))],
      passwordResetAt: Date.now(),
    };
    this.state.ad.users[login] = u;
    this.changed();
    return u;
  }

  // ================================================================ sessions et partages

  /** Le contrôleur de domaine (SRV-01) est-il joignable depuis ce poste ? */
  dcReachable(host: string): boolean {
    const pc = this.pc(host);
    if (pc?.released) return false;
    return this.net.ping(host, DC_IP).result === 'ok';
  }

  /** Ouverture de session : erreur Windows éventuelle, sinon null. */
  logon(host: string, login: string): string | null {
    const pc = this.pc(host);
    const u = this.user(login);
    if (!pc) return 'Poste inconnu.';
    if (!u) return 'Le nom d’utilisateur ou le mot de passe est incorrect.';
    if (!u.enabled) return 'Votre compte a été désactivé. Contactez votre administrateur système.';
    if (u.locked) return 'Le compte référencé est actuellement verrouillé et vous ne pourrez peut-être pas vous y connecter.';
    if (!this.dcReachable(host) && pc.user !== u.login) return 'Aucun serveur d’ouverture de session n’est actuellement disponible pour traiter la demande.';
    pc.user = u.login;
    pc.sessionGroups = [...u.groups];
    if (this.dcReachable(host)) pc.drives = gpoDrives(this.state.ad, pc.sessionGroups);
    this.changed();
    return null;
  }

  /** Redémarrage du poste : nouvelle session (jeton de groupes rafraîchi, GPO réappliquées). */
  reboot(host: string, now: number, durationMs = 6000): void {
    const pc = this.pc(host);
    if (!pc) return;
    pc.rebootUntil = now + durationMs;
    pc.released = false;
    this.changed();
  }

  /** À appeler régulièrement : termine les redémarrages. */
  tick(now: number): void {
    for (const pc of Object.values(this.state.pcs)) {
      if (pc.rebootUntil !== null && now >= pc.rebootUntil) {
        pc.rebootUntil = null;
        const u = this.user(pc.user);
        if (u && !u.locked && u.enabled) {
          pc.sessionGroups = [...u.groups];
          if (this.dcReachable(pc.host)) pc.drives = gpoDrives(this.state.ad, pc.sessionGroups);
        }
        this.changed();
      }
    }
  }

  /** Accès à un partage : 0 = OK, 53 = chemin introuvable (réseau), 5 = accès refusé, 67 = nom introuvable. */
  shareAccess(host: string, path: string): 0 | 5 | 53 | 67 {
    const share = this.state.ad.shares.find((s) => s.path.toLowerCase() === path.toLowerCase());
    if (!this.dcReachable(host)) return 53;
    if (!share) return 67;
    const pc = this.pc(host)!;
    return pc.sessionGroups.includes(share.group) ? 0 : 5;
  }

  /** net use X: \\chemin */
  mapDrive(host: string, letter: string, path: string): 0 | 5 | 53 | 67 | 85 {
    const pc = this.pc(host)!;
    const L = letter.toUpperCase();
    if (pc.drives.some((d) => d.letter === L)) return 85;
    const code = this.shareAccess(host, path);
    if (code !== 0) return code;
    const share = this.state.ad.shares.find((s) => s.path.toLowerCase() === path.toLowerCase())!;
    pc.drives.push({ letter: L, path: share.path });
    this.changed();
    return 0;
  }

  unmapDrive(host: string, letter: string): boolean {
    const pc = this.pc(host)!;
    const before = pc.drives.length;
    pc.drives = pc.drives.filter((d) => d.letter !== letter.toUpperCase());
    this.changed();
    return pc.drives.length !== before;
  }

  /** gpupdate /force : réapplique les lecteurs de la GPO (selon le jeton de session ACTUEL). */
  gpupdate(host: string): boolean {
    const pc = this.pc(host)!;
    if (!this.dcReachable(host)) return false;
    for (const d of gpoDrives(this.state.ad, pc.sessionGroups)) if (!pc.drives.some((x) => x.letter === d.letter)) pc.drives.push(d);
    this.changed();
    return true;
  }

  /** Le lecteur est-il mappé ET accessible ? */
  driveWorks(host: string, letter: string): boolean {
    const pc = this.pc(host);
    const d = pc?.drives.find((x) => x.letter === letter.toUpperCase());
    return !!d && this.shareAccess(host, d.path) === 0;
  }

  // ================================================================ DNS

  private static EXTERNAL: Record<string, string> = {
    'www.google.fr': '142.250.179.67',
    'google.fr': '142.250.179.67',
    'www.google.com': '142.250.201.4',
    'outlook.office365.com': '52.97.183.130',
    'www.entreprise.fr': '51.91.20.10',
    'vpn.entreprise.fr': '51.91.20.11',
  };

  /** Résolution DNS (sans tenir compte de la joignabilité du serveur DNS). */
  resolveName(name: string): string | null {
    const n = name.toLowerCase().replace(/\.$/, '');
    const short = n.replace(/\.entreprise\.local$/, '');
    const fixed: Record<string, string> = {
      'srv-01': DC_IP,
      'srv-fichiers': DC_IP,
      'srv-ad': DC_IP,
      intranet: DC_IP,
      'sw-01': '192.168.99.2',
      'sw-02': '192.168.99.3',
      'rt-fw-01': '192.168.99.254',
      'imp-compta': '192.168.30.10',
    };
    if (fixed[short]) return fixed[short];
    if (Office.EXTERNAL[n]) return Office.EXTERNAL[n];
    const host = Object.keys(this.net.state.hosts).find((h) => h.toLowerCase() === short);
    if (host) {
      const ip = this.net.hostIp(host);
      return ip.status === 'dhcp' || ip.status === 'static' ? ip.ip : null;
    }
    return null;
  }

  // ================================================================ impression

  /** Raisons pour lesquelles un poste ne peut pas imprimer sur une imprimante (vide = ça marche). */
  printProblems(host: string, printerId: string): string[] {
    const p = this.state.printers[printerId];
    const pc = this.pc(host);
    if (!p || !pc) return ['Imprimante inconnue'];
    const problems: string[] = [];
    if (!pc.printers.includes(printerId)) problems.push('Imprimante non installée sur ce poste');
    if (p.host) {
      const ip = this.net.state.hosts[p.host]?.ip.ip;
      if (!ip || this.net.ping(host, ip).result !== 'ok') problems.push('Imprimante injoignable sur le réseau');
    } else if (!(host === 'PC-DIR-01')) problems.push('Imprimante USB d’un autre poste');
    if (p.stuck) problems.push('Un document en erreur bloque la file d’attente');
    if (p.toner <= 3) problems.push('Toner vide');
    if (p.paperJam) problems.push('Bourrage papier');
    return problems;
  }

  purgeQueue(printerId: string): void {
    const p = this.state.printers[printerId];
    if (!p) return;
    p.queue = [];
    p.stuck = false;
    this.changed();
  }

  // ================================================================ matériel / stock

  /** Prendre un objet dans l'étagère vers l'inventaire. */
  takeItem(id: ItemId): string | null {
    if ((this.state.stock[id] ?? 0) <= 0) return `Plus de « ${ITEMS[id].name} » en stock.`;
    const slot = this.state.inventory.indexOf(null);
    if (slot < 0) return 'Inventaire plein (9 emplacements).';
    this.state.stock[id]--;
    this.state.inventory[slot] = id;
    this.changed();
    return null;
  }

  /** Reposer un objet de l'inventaire sur l'étagère. */
  putBack(slot: number): void {
    const id = this.state.inventory[slot];
    if (!id) return;
    this.state.stock[id]++;
    this.state.inventory[slot] = null;
    this.changed();
  }

  hasItem(id: ItemId): boolean {
    return this.state.inventory.includes(id);
  }

  /** Consomme un objet (s'il n'est pas un outil). */
  consume(id: ItemId): boolean {
    const i = this.state.inventory.indexOf(id);
    if (i < 0) return false;
    if (!ITEMS[id].tool) this.state.inventory[i] = null;
    this.changed();
    return true;
  }

  /** Réassort tous les 3 jours. */
  restock(day: number): boolean {
    if (day - this.state.lastRestockDay < 3) return false;
    for (const id of ITEM_IDS) this.state.stock[id] = Math.max(this.state.stock[id], ITEMS[id].base);
    this.state.lastRestockDay = day;
    this.changed();
    return true;
  }
}
