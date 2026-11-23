/**
 * Horloge de jeu : une journée de travail 8h30 → 17h30 dure ~10 minutes réelles.
 * Module pur (testable).
 */

export const DAY_START = 8 * 60 + 30; // 8h30 en minutes
export const DAY_END = 17 * 60 + 30; // 17h30
export const REAL_SECONDS_PER_DAY = 600; // 10 minutes réelles
export const GAME_MINUTES_PER_SECOND = (DAY_END - DAY_START) / REAL_SECONDS_PER_DAY; // 0,9

export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

/** 515.4 → "08:35" */
export function formatTime(minutes: number): string {
  const m = Math.floor(minutes);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface ClockTick {
  /** La minute affichée a changé (pour rafraîchir HUD / écrans). */
  minuteChanged: boolean;
  /** On vient de passer 17h30. */
  dayEnded: boolean;
}

export class GameClock {
  /** Minutes depuis minuit. */
  minutes = DAY_START;
  /** Numéro de journée (1 = première journée). */
  day = 1;
  /** Multiplicateur (1 = normal). */
  speed = 1;
  private ended = false;

  advance(realDt: number): ClockTick {
    if (this.ended) return { minuteChanged: false, dayEnded: false };
    const before = Math.floor(this.minutes);
    this.minutes += realDt * GAME_MINUTES_PER_SECOND * this.speed;
    let dayEnded = false;
    if (this.minutes >= DAY_END) {
      this.minutes = DAY_END;
      this.ended = true;
      dayEnded = true;
    }
    return { minuteChanged: Math.floor(this.minutes) !== before, dayEnded };
  }

  get isDayOver(): boolean {
    return this.ended;
  }

  /** Passe à la journée suivante, 8h30. */
  nextDay(): void {
    this.day += 1;
    this.minutes = DAY_START;
    this.ended = false;
  }

  /** Progression de la journée entre 0 et 1. */
  get progress(): number {
    return (this.minutes - DAY_START) / (DAY_END - DAY_START);
  }

  get weekday(): string {
    return WEEKDAYS[(this.day - 1) % WEEKDAYS.length];
  }

  restore(day: number, minutes: number): void {
    this.day = day;
    this.minutes = Math.min(Math.max(minutes, DAY_START), DAY_END);
    this.ended = this.minutes >= DAY_END;
  }
}
