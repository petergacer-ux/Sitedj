/**
 * Écrans plein écran : accueil (obligatoire pour verrouiller la souris), pause,
 * options, « cliquer pour reprendre » et bilan de fin de journée.
 */
import type { Quality, Settings } from '../state/settings';
import { el, escapeHtml } from './dom';

export interface MenuCallbacks {
  onStart(continueGame: boolean): void;
  onResume(): void;
  onSave(): void;
  onLoad(): void;
  onSettings(s: Settings): void;
  onQuitToTitle(): void;
  onNextDay(): void;
}

export class Menus {
  private start: HTMLElement;
  private pause: HTMLElement;
  private options: HTMLElement;
  private resume: HTMLElement;
  private dayEnd: HTMLElement;
  private optionsReturn: 'start' | 'pause' = 'start';

  constructor(parent: HTMLElement, private settings: Settings, private cb: MenuCallbacks, hasSave: () => boolean) {
    // --- Accueil ---
    this.start = el('div', { class: 'screen start-screen' });
    this.start.innerHTML = `
      <div class="panel start-panel">
        <div class="logo">🖥️🔧</div>
        <h1>HelpDesk Simulator</h1>
        <p class="subtitle">Une journée dans la peau d'un technicien support IT</p>
        <div class="menu-buttons">
          <button class="btn primary" data-act="new">Nouvelle partie</button>
          <button class="btn" data-act="continue">Continuer la partie sauvegardée</button>
          <button class="btn" data-act="options">Options</button>
        </div>
        <div class="controls-grid">
          <div><kbd>ZQSD</kbd>/<kbd>WASD</kbd> se déplacer</div>
          <div><kbd>Souris</kbd> regarder</div>
          <div><kbd>Maj</kbd> courir</div>
          <div><kbd>C</kbd> se baisser</div>
          <div><kbd>E</kbd> interagir</div>
          <div><kbd>M</kbd> plan de l'étage</div>
          <div><kbd>H</kbd> afficher / masquer l'aide</div>
          <div><kbd>Échap</kbd> fermer / pause</div>
        </div>
        <p class="note">Cliquer sur un bouton verrouille la souris dans le jeu (Pointer Lock). Appuyez sur <kbd>Échap</kbd> pour la libérer.</p>
      </div>`;
    this.start.querySelector('[data-act="new"]')!.addEventListener('click', () => cb.onStart(false));
    const cont = this.start.querySelector<HTMLButtonElement>('[data-act="continue"]')!;
    cont.addEventListener('click', () => cb.onStart(true));
    this.start.querySelector('[data-act="options"]')!.addEventListener('click', () => this.showOptions('start'));
    this.refreshContinue = () => {
      cont.style.display = hasSave() ? '' : 'none';
    };

    // --- Pause ---
    this.pause = el('div', { class: 'screen pause-screen hidden' });
    this.pause.innerHTML = `
      <div class="panel">
        <h2>Pause</h2>
        <div class="menu-buttons">
          <button class="btn primary" data-act="resume">Reprendre</button>
          <button class="btn" data-act="save">💾 Sauvegarder</button>
          <button class="btn" data-act="load">📂 Charger</button>
          <button class="btn" data-act="options">⚙️ Options</button>
          <button class="btn danger" data-act="quit">Retour à l'accueil</button>
        </div>
      </div>`;
    this.pause.querySelector('[data-act="resume"]')!.addEventListener('click', () => cb.onResume());
    this.pause.querySelector('[data-act="save"]')!.addEventListener('click', () => cb.onSave());
    this.pause.querySelector('[data-act="load"]')!.addEventListener('click', () => cb.onLoad());
    this.pause.querySelector('[data-act="options"]')!.addEventListener('click', () => this.showOptions('pause'));
    this.pause.querySelector('[data-act="quit"]')!.addEventListener('click', () => cb.onQuitToTitle());

    // --- Options ---
    this.options = el('div', { class: 'screen options-screen hidden' });
    this.buildOptions();

    // --- Cliquer pour reprendre ---
    this.resume = el('div', { class: 'screen resume-screen hidden' }, [el('div', { class: 'resume-text' }, ['🖱️ Cliquez pour reprendre'])]);
    this.resume.addEventListener('click', () => cb.onResume());

    // --- Fin de journée ---
    this.dayEnd = el('div', { class: 'screen dayend-screen hidden' });

    parent.append(this.start, this.pause, this.options, this.resume, this.dayEnd);
    this.refreshContinue();
  }

  refreshContinue: () => void;

  private buildOptions(): void {
    const s = this.settings;
    this.options.innerHTML = `
      <div class="panel options-panel">
        <h2>Options</h2>
        <label class="opt"><span>Sensibilité de la souris <b data-v="sensitivity"></b></span><input type="range" min="0.2" max="3" step="0.05" data-k="sensitivity"></label>
        <label class="opt"><span>Champ de vision <b data-v="fov"></b></span><input type="range" min="60" max="95" step="1" data-k="fov"></label>
        <label class="opt"><span>Qualité graphique</span>
          <select data-k="quality">
            <option value="low">Basse (sans ombres, résolution réduite)</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute (ombres fines, pleine résolution)</option>
          </select></label>
        <label class="opt check"><input type="checkbox" data-k="headBob"> Balancement de la caméra en marchant</label>
        <label class="opt check"><input type="checkbox" data-k="showHints"> Afficher l'aide des touches</label>
        <label class="opt check"><input type="checkbox" data-k="showFps"> Afficher les FPS</label>
        <label class="opt check"><input type="checkbox" data-k="muted"> Couper le son</label>
        <label class="opt"><span>Volume <b data-v="volume"></b></span><input type="range" min="0" max="1" step="0.05" data-k="volume"></label>
        <p class="note">L'anticrénelage (qualité basse ↔ moyenne/haute) s'applique au prochain chargement de la page.</p>
        <div class="menu-buttons"><button class="btn primary" data-act="back">Retour</button></div>
      </div>`;
    const fmt = (k: string, v: unknown) =>
      k === 'sensitivity' ? `${Number(v).toFixed(2)}×` : k === 'fov' ? `${v}°` : k === 'volume' ? `${Math.round(Number(v) * 100)} %` : String(v);
    this.options.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((input) => {
      const k = input.dataset.k as keyof Settings;
      const label = this.options.querySelector(`[data-v="${k}"]`);
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = Boolean(s[k]);
      else input.value = String(s[k]);
      if (label) label.textContent = fmt(k, s[k]);
      input.addEventListener('input', () => {
        const rec = s as unknown as Record<string, unknown>;
        if (input instanceof HTMLInputElement && input.type === 'checkbox') rec[k] = input.checked;
        else if (k === 'quality') rec[k] = input.value as Quality;
        else rec[k] = Number(input.value);
        if (label) label.textContent = fmt(k, s[k]);
        this.cb.onSettings(s);
      });
    });
    this.options.querySelector('[data-act="back"]')!.addEventListener('click', () => {
      this.options.classList.add('hidden');
      (this.optionsReturn === 'start' ? this.start : this.pause).classList.remove('hidden');
    });
  }

  private showOptions(from: 'start' | 'pause'): void {
    this.optionsReturn = from;
    this.start.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.options.classList.remove('hidden');
  }

  hideAll(): void {
    [this.start, this.pause, this.options, this.resume, this.dayEnd].forEach((e) => e.classList.add('hidden'));
  }

  showStart(): void {
    this.hideAll();
    this.refreshContinue();
    this.start.classList.remove('hidden');
  }

  showPause(): void {
    this.hideAll();
    this.pause.classList.remove('hidden');
  }

  showResume(): void {
    this.hideAll();
    this.resume.classList.remove('hidden');
  }

  showDayEnd(lines: { label: string; value: string }[], remark: string, title: string): void {
    this.hideAll();
    this.dayEnd.innerHTML = `
      <div class="panel dayend-panel">
        <h2>${escapeHtml(title)}</h2>
        <table class="bilan">${lines.map((l) => `<tr><td>${escapeHtml(l.label)}</td><td>${escapeHtml(l.value)}</td></tr>`).join('')}</table>
        <blockquote class="boss">« ${escapeHtml(remark)} »<cite>— Bernard, responsable du service informatique</cite></blockquote>
        <p class="note">Partie sauvegardée automatiquement.</p>
        <div class="menu-buttons"><button class="btn primary" data-act="next">Journée suivante ▶</button></div>
      </div>`;
    this.dayEnd.querySelector('[data-act="next"]')!.addEventListener('click', () => this.cb.onNextDay());
    this.dayEnd.classList.remove('hidden');
  }
}
