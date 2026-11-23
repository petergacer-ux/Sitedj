/**
 * Système de tickets (indépendant de l'affichage) :
 * création à partir des scénarios (la panne est injectée dans le monde), cycle de vie
 * Nouveau → En cours → En attente → Résolu → Clos, suivis, SLA, satisfaction, réouverture
 * si le problème n'est pas RÉELLEMENT corrigé.
 */
import { DESKS } from '../data/map';
import { USERS, getUser } from '../data/users';
import { SCENARIOS, getScenario } from '../data/scenarios';
import type { Network } from '../network/Network';
import type { Office } from '../sim/Office';
import { SLA_MINUTES, type Channel, type ScenarioCtx, type ScenarioDef, type ScenarioTarget, type Ticket } from './types';

export interface TicketState {
  tickets: Ticket[];
  nextId: number;
  /** Prochaine apparition aléatoire (minutes absolues). */
  nextSpawnAt: number;
  /** Satisfaction des derniers tickets clos (moyenne glissante). */
  history: number[];
}

export function createTicketState(): TicketState {
  return { tickets: [], nextId: 1001, nextSpawnAt: 0, history: [] };
}

export interface ResolveResult {
  ok: boolean;
  message: string;
  xp: number;
  satisfaction: number | null;
}

/** Minutes absolues de jeu (jour × 1440 + minutes du jour). */
export function absMinutes(day: number, minutes: number): number {
  return day * 1440 + minutes;
}

export function fill(text: string, t: ScenarioTarget): string {
  const u = getUser(t.user);
  return text
    .replace(/\{prenom\}/g, u?.firstName ?? t.user)
    .replace(/\{nom\}/g, u?.lastName ?? '')
    .replace(/\{bureau\}/g, t.desk)
    .replace(/\{pc\}/g, t.host);
}

export class TicketSystem {
  state: TicketState = createTicketState();
  private listeners = new Set<(e: { type: 'created' | 'updated' | 'reopened' | 'solved' | 'closed'; ticket: Ticket }) => void>();

  constructor(
    private office: Office,
    private net: Network,
    public rng: () => number = Math.random,
  ) {}

  get ctx(): ScenarioCtx {
    return { office: this.office, net: this.net, rng: this.rng };
  }

  onEvent(fn: (e: { type: 'created' | 'updated' | 'reopened' | 'solved' | 'closed'; ticket: Ticket }) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(type: 'created' | 'updated' | 'reopened' | 'solved' | 'closed', ticket: Ticket): void {
    this.listeners.forEach((fn) => fn({ type, ticket }));
  }

  load(state: TicketState): void {
    this.state = state;
  }

  get open(): Ticket[] {
    return this.state.tickets.filter((t) => t.status !== 'closed' && t.status !== 'solved');
  }

  get(id: number): Ticket | undefined {
    return this.state.tickets.find((t) => t.id === id);
  }

  /** Utilisateurs/postes déjà concernés par un ticket ouvert. */
  private busy(): Set<string> {
    const s = new Set<string>();
    for (const t of this.open) {
      s.add(t.requester);
      s.add(t.host);
    }
    return s;
  }

  /** Cibles possibles pour un scénario. */
  targetsFor(sc: ScenarioDef): ScenarioTarget[] {
    const busy = this.busy();
    if (sc.fixedTarget) {
      const t = sc.fixedTarget(this.ctx);
      if (!t || busy.has(t.host) || busy.has(t.user)) return [];
      // Le scénario « nouvel arrivant » n'a de sens qu'une fois.
      if (this.state.tickets.some((x) => x.scenario === sc.id)) return [];
      return [t];
    }
    const out: ScenarioTarget[] = [];
    for (const u of USERS) {
      const desk = DESKS.find((d) => d.userId === u.id);
      if (!desk || busy.has(u.id) || busy.has(desk.pcName)) continue;
      if (sc.eligible && !sc.eligible(this.ctx, u)) continue;
      out.push({ user: u.id, host: desk.pcName, desk: desk.id, data: {} });
    }
    return out;
  }

  /** Crée un ticket pour un scénario : injecte la panne dans le monde. */
  create(sc: ScenarioDef, target: ScenarioTarget, now: number, channel?: Channel): Ticket[] {
    sc.inject(this.ctx, target);
    const extra = sc.extraTargets?.(this.ctx, target) ?? [];
    const created: Ticket[] = [];
    for (const t of [target, ...extra]) {
      const ticket: Ticket = {
        id: this.state.nextId++,
        scenario: sc.id,
        title: fill(sc.titles[Math.floor(this.rng() * sc.titles.length)], t),
        description: fill(sc.descriptions[Math.floor(this.rng() * sc.descriptions.length)], t),
        requester: t.user,
        desk: t.desk,
        host: t.host,
        category: sc.category,
        priority: sc.priority,
        status: 'new',
        channel: channel ?? sc.channel ?? 'glpi',
        openedAt: now,
        slaMinutes: SLA_MINUTES[sc.priority],
        followups: [],
        reopenCount: 0,
        contacted: false,
        escalated: false,
        solvedAt: null,
        closedAt: null,
        satisfaction: null,
        xp: null,
        slaMissed: false,
        data: { ...t.data },
      };
      this.state.tickets.push(ticket);
      created.push(ticket);
      this.emit('created', ticket);
    }
    return created;
  }

  /** Tire un scénario au hasard adapté au niveau du joueur. */
  pickScenario(level: number, exclude: string[] = []): { sc: ScenarioDef; target: ScenarioTarget } | null {
    const pool = SCENARIOS.filter((s) => s.minLevel <= level && !exclude.includes(s.id) && !this.open.some((t) => t.scenario === s.id));
    const weighted: { sc: ScenarioDef; target: ScenarioTarget; w: number }[] = [];
    for (const sc of pool) {
      const targets = this.targetsFor(sc);
      if (!targets.length) continue;
      // Les scénarios de son niveau tombent plus souvent.
      const w = (sc.weight ?? 1) * (sc.minLevel === level ? 2 : 1);
      weighted.push({ sc, target: targets[Math.floor(this.rng() * targets.length)], w });
    }
    if (!weighted.length) return null;
    let r = this.rng() * weighted.reduce((a, b) => a + b.w, 0);
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) return x;
    }
    return weighted[weighted.length - 1];
  }

  slaRemaining(t: Ticket, now: number): number {
    return t.openedAt + t.slaMinutes - now;
  }

  private touch(t: Ticket): void {
    this.emit('updated', t);
  }

  addFollowup(id: number, author: string, text: string, kind: 'user' | 'tech' | 'system' | 'solution', now: number): void {
    const t = this.get(id);
    if (!t) return;
    t.followups.push({ at: now, author, text, kind });
    if (kind === 'tech') t.contacted = true;
    this.touch(t);
  }

  take(id: number, now: number): void {
    const t = this.get(id);
    if (!t || (t.status !== 'new' && t.status !== 'pending')) return;
    t.status = 'assigned';
    t.followups.push({ at: now, author: 'Système', text: 'Ticket pris en charge par technicien.helpdesk', kind: 'system' });
    this.touch(t);
  }

  setPending(id: number, now: number): void {
    const t = this.get(id);
    if (!t || t.status === 'closed' || t.status === 'solved') return;
    t.status = 'pending';
    t.followups.push({ at: now, author: 'Système', text: 'Ticket mis en attente', kind: 'system' });
    this.touch(t);
  }

  /** Le technicien a parlé à l'utilisateur (visite ou téléphone). */
  markContacted(id: number): void {
    const t = this.get(id);
    if (t) t.contacted = true;
  }

  isResolved(t: Ticket): boolean {
    const sc = getScenario(t.scenario);
    if (!sc) return true;
    return sc.isResolved(this.ctx, { user: t.requester, host: t.host, desk: t.desk, data: t.data });
  }

  /** « Résoudre » : le jeu vérifie l'état réel du monde. */
  resolve(id: number, solution: string, now: number): ResolveResult {
    const t = this.get(id);
    if (!t) return { ok: false, message: 'Ticket introuvable', xp: 0, satisfaction: null };
    const sc = getScenario(t.scenario);
    t.followups.push({ at: now, author: 'technicien.helpdesk', text: solution || 'Résolu.', kind: 'solution' });
    if (!this.isResolved(t)) {
      t.reopenCount++;
      t.status = 'assigned';
      const u = getUser(t.requester);
      const angry = u?.personality === 'raleur' || u?.personality === 'presse';
      t.followups.push({
        at: now + 5,
        author: u ? `${u.firstName} ${u.lastName}` : t.requester,
        text: angry ? 'Non mais ça ne marche TOUJOURS PAS. Vous avez vérifié au moins ?' : 'Bonjour, désolé mais le problème est toujours là… Je rouvre le ticket.',
        kind: 'user',
      });
      this.emit('reopened', t);
      return { ok: false, message: 'L’utilisateur a rouvert le ticket : le problème n’est pas réglé.', xp: 0, satisfaction: null };
    }
    const late = now - t.openedAt > t.slaMinutes;
    t.slaMissed = late;
    t.status = 'solved';
    t.solvedAt = now;
    const u = getUser(t.requester);
    let sat = 72 + (late ? -22 : 12) + (t.contacted ? 10 : -5) - t.reopenCount * 15;
    if (t.priority === 4 && late) sat -= 10;
    if (u?.personality === 'raleur') sat -= 6;
    if (u?.personality === 'sympa') sat += 6;
    if (t.escalated) sat -= 5;
    sat = Math.max(0, Math.min(100, Math.round(sat)));
    let xp = sc ? sc.xp : 30;
    if (late) xp = Math.round(xp * 0.6);
    if (t.contacted) xp += 10;
    xp = Math.max(5, xp - t.reopenCount * 10);
    t.satisfaction = sat;
    t.xp = xp;
    this.state.history.push(sat);
    if (this.state.history.length > 12) this.state.history.shift();
    this.emit('solved', t);
    return { ok: true, message: late ? 'Ticket résolu, mais hors délai (SLA dépassé).' : 'Ticket résolu dans les délais !', xp, satisfaction: sat };
  }

  /** Escalade au niveau 2 : le ticket part chez un collègue, sans XP. */
  escalate(id: number, reason: string, now: number): void {
    const t = this.get(id);
    if (!t) return;
    t.escalated = true;
    t.followups.push({ at: now, author: 'technicien.helpdesk', text: `Escaladé au niveau 2 : ${reason || 'hors de mon périmètre'}`, kind: 'system' });
    t.status = 'closed';
    t.closedAt = now;
    t.satisfaction = 60;
    t.xp = 0;
    this.state.history.push(60);
    // Le niveau 2 répare la panne en coulisses.
    const sc = getScenario(t.scenario);
    sc?.solve(this.ctx, { user: t.requester, host: t.host, desk: t.desk, data: t.data });
    this.net.changed();
    this.office.changed();
    this.emit('closed', t);
  }

  /** Clôture automatique des tickets résolus après validation de l'utilisateur. */
  tick(now: number): Ticket[] {
    const closed: Ticket[] = [];
    for (const t of this.state.tickets) {
      if (t.status === 'solved' && t.solvedAt !== null && now - t.solvedAt >= 30) {
        t.status = 'closed';
        t.closedAt = now;
        t.followups.push({ at: now, author: 'Système', text: 'Solution approuvée par le demandeur. Ticket clos.', kind: 'system' });
        closed.push(t);
        this.emit('closed', t);
      }
      if ((t.status === 'new' || t.status === 'assigned' || t.status === 'pending') && !t.slaMissed && now - t.openedAt > t.slaMinutes) {
        t.slaMissed = true;
        t.followups.push({ at: now, author: 'Système', text: 'Délai de résolution (SLA) dépassé.', kind: 'system' });
        this.touch(t);
      }
    }
    return closed;
  }

  averageSatisfaction(fallback: number): number {
    const h = this.state.history;
    if (!h.length) return fallback;
    return h.reduce((a, b) => a + b, 0) / h.length;
  }
}
