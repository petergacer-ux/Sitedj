/** Types des tickets et des scénarios (pilotés par les données). */
import type { UserDef } from '../data/users';
import type { Network } from '../network/Network';
import type { Office } from '../sim/Office';

export type Category = 'Réseau' | 'Messagerie' | 'Impression' | 'Matériel' | 'Compte/AD' | 'Logiciel' | 'Téléphonie' | 'Sécurité';
/** 1 = Basse, 2 = Moyenne, 3 = Haute, 4 = Très haute */
export type Priority = 1 | 2 | 3 | 4;
export type TicketStatus = 'new' | 'assigned' | 'pending' | 'solved' | 'closed';
export type Channel = 'glpi' | 'phone' | 'visit';

export const PRIORITY_NAMES: Record<Priority, string> = { 1: 'Basse', 2: 'Moyenne', 3: 'Haute', 4: 'Très haute' };
export const STATUS_NAMES: Record<TicketStatus, string> = { new: 'Nouveau', assigned: 'En cours', pending: 'En attente', solved: 'Résolu', closed: 'Clos' };
/** Délai de résolution (minutes de jeu) selon la priorité. */
export const SLA_MINUTES: Record<Priority, number> = { 1: 480, 2: 240, 3: 120, 4: 60 };

export interface Followup {
  at: number;
  author: string;
  text: string;
  kind: 'user' | 'tech' | 'system' | 'solution';
}

export interface Ticket {
  id: number;
  scenario: string;
  title: string;
  description: string;
  requester: string; // login
  desk: string;
  host: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  channel: Channel;
  /** Minutes de jeu absolues (jour × 1440 + minutes). */
  openedAt: number;
  slaMinutes: number;
  followups: Followup[];
  reopenCount: number;
  /** Le technicien a communiqué avec l'utilisateur (suivi, appel, visite). */
  contacted: boolean;
  escalated: boolean;
  solvedAt: number | null;
  closedAt: number | null;
  satisfaction: number | null;
  xp: number | null;
  slaMissed: boolean;
  /** Données propres au scénario (cible, cause tirée au sort…). */
  data: Record<string, string | number | boolean>;
}

export interface ScenarioCtx {
  office: Office;
  net: Network;
  rng: () => number;
}

export interface ScenarioTarget {
  user: string;
  host: string;
  desk: string;
  data: Record<string, string | number | boolean>;
}

export interface ScenarioDef {
  id: string;
  /** Grade minimum : 0 Stagiaire, 1 Technicien N1, 2 Technicien N2, 3 Admin réseau. */
  minLevel: 0 | 1 | 2 | 3;
  category: Category;
  priority: Priority;
  /** Canal d'arrivée préféré (par défaut : au hasard). */
  channel?: Channel;
  weight?: number;
  /** Variantes de titre et de description (placeholders {prenom} {nom} {bureau} {pc}). */
  titles: string[];
  descriptions: string[];
  /** Utilisateurs concernés possibles. */
  eligible?: (ctx: ScenarioCtx, user: UserDef) => boolean;
  /** Cible imposée (ex. bureau B-12 pour le nouvel arrivant). */
  fixedTarget?: (ctx: ScenarioCtx) => ScenarioTarget | null;
  /** Provoque la panne réelle dans le monde. */
  inject: (ctx: ScenarioCtx, t: ScenarioTarget) => void;
  /** Le problème est-il RÉELLEMENT corrigé ? */
  isResolved: (ctx: ScenarioCtx, t: ScenarioTarget) => boolean;
  /** Ce que raconte l'utilisateur quand on lui parle. */
  dialog: { describe: string[]; before: string[] };
  /** Ce que le technicien peut observer (base de connaissances, indices). */
  clues: string[];
  /** Fiche de la base de connaissances. */
  solution: string;
  xp: number;
  /** Utilisé par les tests : résout le problème comme le ferait le joueur. */
  solve: (ctx: ScenarioCtx, t: ScenarioTarget) => void;
  /** Tickets supplémentaires créés en même temps (panne générale). */
  extraTargets?: (ctx: ScenarioCtx, t: ScenarioTarget) => ScenarioTarget[];
}

export function defineScenario(s: ScenarioDef): ScenarioDef {
  return s;
}
