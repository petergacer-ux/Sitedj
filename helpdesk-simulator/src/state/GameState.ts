/**
 * État global du jeu : SOURCE DE VÉRITÉ unique.
 * Les étapes suivantes y brancheront le réseau, les tickets, l'AD…
 * que GLPI, les terminaux et la carte liront tous.
 */
import { GameClock } from './clock';
import { EventBus } from './events';

export const LEVELS = [
  { name: 'Stagiaire', xp: 0 },
  { name: 'Technicien N1', xp: 300 },
  { name: 'Technicien N2', xp: 900 },
  { name: 'Admin réseau', xp: 2000 },
];

export type GameEvents = {
  toast: { text: string; kind?: 'info' | 'ok' | 'warn' | 'error' | 'ticket'; title?: string };
  statsChanged: void;
  minute: number;
  dayEnded: number;
};

export interface DayStats {
  ticketsResolved: number;
  slaOk: number;
  slaMissed: number;
  coffees: number;
  xpGained: number;
}

export class GameState {
  readonly events = new EventBus<GameEvents>();
  readonly clock = new GameClock();

  energy = 100;
  xp = 0;
  satisfaction = 80;
  /** Bureaux (ids de prise) ayant un ticket ouvert — alimenté à l'étape 4. */
  openTicketDesks = new Set<string>();
  hasBadge = true;
  day: DayStats = GameState.emptyDay();
  lastCoffeeAt = -999;

  static emptyDay(): DayStats {
    return { ticketsResolved: 0, slaOk: 0, slaMissed: 0, coffees: 0, xpGained: 0 };
  }

  get levelIndex(): number {
    let idx = 0;
    LEVELS.forEach((l, i) => {
      if (this.xp >= l.xp) idx = i;
    });
    return idx;
  }

  get levelName(): string {
    return LEVELS[this.levelIndex].name;
  }

  /** XP restante avant le niveau suivant (null au niveau max). */
  get nextLevelXp(): number | null {
    const next = LEVELS[this.levelIndex + 1];
    return next ? next.xp : null;
  }

  addXp(amount: number): void {
    const before = this.levelIndex;
    this.xp += amount;
    this.day.xpGained += amount;
    if (this.levelIndex > before) {
      this.toast(`Nouveau grade : ${this.levelName} !`, 'ok', 'Promotion');
    }
    this.events.emit('statsChanged', undefined);
  }

  setEnergy(v: number): void {
    this.energy = Math.max(0, Math.min(100, v));
    this.events.emit('statsChanged', undefined);
  }

  toast(text: string, kind: GameEvents['toast']['kind'] = 'info', title?: string): void {
    this.events.emit('toast', { text, kind, title });
  }

  /** Avance le temps (appelé à chaque image hors pause). */
  update(dt: number): void {
    const tick = this.clock.advance(dt);
    if (tick.minuteChanged) {
      // L'énergie baisse doucement : ~ -8 par heure de jeu.
      this.energy = Math.max(0, this.energy - 8 / 60);
      this.events.emit('minute', this.clock.minutes);
      this.events.emit('statsChanged', undefined);
    }
    if (tick.dayEnded) this.events.emit('dayEnded', this.clock.day);
  }
}
