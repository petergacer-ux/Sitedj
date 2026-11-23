/**
 * HUD discret : viseur, bulle d'interaction, horloge, statistiques, raccourcis.
 */
import { DAY_END, DAY_START, formatTime } from '../state/clock';
import type { GameState } from '../state/GameState';
import { LEVELS } from '../state/GameState';
import { el, escapeHtml } from './dom';

export class Hud {
  readonly root: HTMLElement;
  private crosshair: HTMLElement;
  private prompt: HTMLElement;
  private clock: HTMLElement;
  private dayBar: HTMLElement;
  private stats: HTMLElement;
  private hints: HTMLElement;
  private crouch: HTMLElement;
  private focusHint: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', { class: 'hud' });
    this.crosshair = el('div', { class: 'crosshair' });
    this.prompt = el('div', { class: 'interact-prompt' });
    const clockBox = el('div', { class: 'hud-clock' });
    this.clock = el('div', { class: 'hud-clock-text' });
    this.dayBar = el('div', { class: 'hud-day-bar-fill' });
    clockBox.append(this.clock, el('div', { class: 'hud-day-bar' }, [this.dayBar]));
    this.stats = el('div', { class: 'hud-stats' });
    this.hints = el('div', { class: 'hud-hints' });
    this.hints.innerHTML = [
      ['ZQSD / WASD', 'se déplacer'],
      ['Maj', 'courir'],
      ['C', 'se baisser'],
      ['E / clic', 'interagir'],
      ['M', 'plan de l’étage'],
      ['H', 'masquer l’aide'],
      ['Échap / P', 'pause'],
    ]
      .map(([k, v]) => `<div><kbd>${k}</kbd> ${v}</div>`)
      .join('');
    this.crouch = el('div', { class: 'hud-crouch' }, ['⬇ accroupi']);
    this.focusHint = el('div', { class: 'focus-hint' });
    this.root.append(this.crosshair, this.prompt, clockBox, this.stats, this.hints, this.crouch, this.focusHint);
    parent.append(this.root);
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  /** Cache juste le viseur et la bulle (pendant une interface ouverte). */
  setCrosshairVisible(v: boolean): void {
    this.crosshair.style.display = v ? '' : 'none';
    if (!v) this.setPrompt(null);
  }

  setHintsVisible(v: boolean): void {
    this.hints.classList.toggle('hidden', !v);
  }

  toggleHints(): boolean {
    const hidden = this.hints.classList.toggle('hidden');
    return !hidden;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.prompt.classList.remove('show');
      this.crosshair.classList.remove('active');
      return;
    }
    // « E — Ouvrir la porte » → touche stylée + texte
    const [key, ...rest] = text.split(' — ');
    this.prompt.innerHTML = rest.length ? `<kbd>${escapeHtml(key)}</kbd> ${escapeHtml(rest.join(' — '))}` : escapeHtml(text);
    this.prompt.classList.add('show');
    this.crosshair.classList.add('active');
  }

  setCrouching(v: boolean): void {
    this.crouch.classList.toggle('show', v);
  }

  /** Bandeau d'aide pendant une vue rapprochée (baie…). */
  setFocusHint(html: string | null): void {
    this.focusHint.innerHTML = html ?? '';
    this.focusHint.classList.toggle('show', !!html);
  }

  update(state: GameState): void {
    const c = state.clock;
    this.clock.textContent = `${c.weekday} · Jour ${c.day} — ${formatTime(c.minutes)}`;
    this.dayBar.style.width = `${((c.minutes - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
    const lvl = state.levelIndex;
    const cur = LEVELS[lvl].xp;
    const next = state.nextLevelXp;
    const pct = next ? ((state.xp - cur) / (next - cur)) * 100 : 100;
    const energyColor = state.energy > 50 ? '#4caf50' : state.energy > 20 ? '#ffb300' : '#e53935';
    const sat = Math.round(state.satisfaction);
    const satEmoji = sat >= 75 ? '😊' : sat >= 50 ? '😐' : '😠';
    this.stats.innerHTML = `
      <div class="stat-line"><span class="stat-level">${escapeHtml(state.levelName)}</span><span class="stat-xp">${state.xp} XP</span></div>
      <div class="bar"><div class="bar-fill xp" style="width:${pct}%"></div></div>
      <div class="stat-line"><span>🎫 Tickets ouverts</span><b>${state.openTicketDesks.size}</b></div>
      <div class="stat-line"><span>${satEmoji} Satisfaction</span><b>${sat} %</b></div>
      <div class="stat-line"><span>⚡ Énergie</span><b>${Math.round(state.energy)}</b></div>
      <div class="bar"><div class="bar-fill" style="width:${state.energy}%;background:${energyColor}"></div></div>`;
  }
}
