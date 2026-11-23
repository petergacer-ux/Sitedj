/**
 * Modèle « bureautique » de l'entreprise (hors réseau) : Active Directory, postes Windows,
 * imprimantes, stock de matériel, prêts. Tout est sérialisable (sauvegarde).
 */

export interface AdUser {
  login: string;
  firstName: string;
  lastName: string;
  service: string;
  enabled: boolean;
  locked: boolean;
  mustChangePassword: boolean;
  /** Mot de passe expiré (ex. VPN refusé). */
  passwordExpired: boolean;
  groups: string[];
  /** Le mot de passe a été réinitialisé par le helpdesk. */
  passwordResetAt: number | null;
  /** Compte compromis (clic sur un lien de phishing) : mot de passe à changer. */
  compromised?: boolean;
}

export interface AdGroup {
  name: string;
  description: string;
}

export interface Share {
  /** Chemin UNC, ex. \\SRV-FICHIERS\Compta */
  path: string;
  group: string;
  /** Lettre mappée par GPO aux membres du groupe. */
  letter: string;
}

export interface AdState {
  domain: string;
  users: Record<string, AdUser>;
  groups: Record<string, AdGroup>;
  shares: Share[];
}

export interface Mail {
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  phishing?: {
    /** Indices réels de l'hameçonnage (pour le quiz). */
    clues: string[];
    reported: boolean;
    clicked: boolean;
  };
}

export interface PrintJob {
  doc: string;
  owner: string;
  status: 'En attente' | 'Impression' | 'Erreur - Impression';
}

export interface PrinterState {
  id: string;
  name: string;
  /** Hôte réseau (null = imprimante USB locale). */
  host: string | null;
  toner: number; // %
  paperJam: boolean;
  queue: PrintJob[];
  /** File bloquée (document en erreur). */
  stuck: boolean;
}

export interface PcState {
  host: string;
  /** Login de la session ouverte (null = personne). */
  user: string | null;
  /** Groupes du jeton de session (figés à l'ouverture de session, comme sous Windows). */
  sessionGroups: string[];
  monitorOn: boolean;
  videoCable: boolean;
  monitorDead: boolean;
  powerCable: boolean;
  ramGb: number;
  drives: { letter: string; path: string }[];
  outlook: { profileCorrupt: boolean; mailboxUsage: number; shared: string[]; mails: Mail[]; blocked: string[] };
  printers: string[];
  defaultPrinter: string | null;
  displayDriverOk: boolean;
  /** ipconfig /release en cours. */
  released: boolean;
  /** Fin de redémarrage (temps réel, ms) ou null. */
  rebootUntil: number | null;
}

export type ItemId =
  | 'rj45'
  | 'patch'
  | 'tester'
  | 'usb'
  | 'mouse'
  | 'keyboard'
  | 'monitor'
  | 'psu'
  | 'dock'
  | 'toner'
  | 'cartridge'
  | 'screwdriver'
  | 'ram'
  | 'laptop'
  | 'videocable';

export interface Loan {
  id: number;
  user: string;
  item: string;
  serial: string;
  from: string;
  to: string;
  condition: string;
  /** Le portable a été remis à l'utilisateur. */
  delivered: boolean;
  returned: boolean;
}

export interface OfficeState {
  ad: AdState;
  pcs: Record<string, PcState>;
  printers: Record<string, PrinterState>;
  stock: Record<ItemId, number>;
  /** Barre d'inventaire du joueur (9 emplacements). */
  inventory: (ItemId | null)[];
  loans: Loan[];
  nextLoanId: number;
  /** Jour du dernier réassort. */
  lastRestockDay: number;
  /** Indicateurs libres utilisés par les scénarios. */
  flags: Record<string, string | number | boolean>;
}
