import { describe, expect, it } from 'vitest';
import { DAY_END, DAY_START, GameClock, formatTime } from './clock';

describe('horloge de jeu', () => {
  it('formate les heures', () => {
    expect(formatTime(DAY_START)).toBe('08:30');
    expect(formatTime(17 * 60 + 5.9)).toBe('17:05');
  });

  it('une journée dure 10 minutes réelles', () => {
    const c = new GameClock();
    let ended = false;
    for (let i = 0; i < 600 * 10; i++) ended = c.advance(0.1).dayEnded || ended;
    expect(ended).toBe(true);
    expect(c.minutes).toBe(DAY_END);
  });

  it('signale le changement de minute', () => {
    const c = new GameClock();
    expect(c.advance(0.5).minuteChanged).toBe(false); // 0,45 min
    expect(c.advance(0.7).minuteChanged).toBe(true); // 1,08 min
  });

  it('passe à la journée suivante', () => {
    const c = new GameClock();
    c.advance(1000);
    expect(c.isDayOver).toBe(true);
    c.nextDay();
    expect(c.day).toBe(2);
    expect(c.minutes).toBe(DAY_START);
    expect(c.weekday).toBe('Mardi');
  });
});
