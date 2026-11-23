/** Options du joueur, sauvegardées dans localStorage. */

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  /** Sensibilité de la souris (multiplicateur, 0,2 → 3). */
  sensitivity: number;
  quality: Quality;
  headBob: boolean;
  muted: boolean;
  volume: number; // 0 → 1
  fov: number;
  showHints: boolean;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  quality: 'medium',
  headBob: true,
  muted: false,
  volume: 0.6,
  fov: 72,
  showHints: true,
  showFps: false,
};

const KEY = 'helpdesk-sim.settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* stockage indisponible : on garde les valeurs par défaut */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignoré */
  }
}
