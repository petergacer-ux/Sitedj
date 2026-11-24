/**
 * Composant terminal générique (fond noir, police monospace) :
 * historique ↑/↓, Tab (complétion), « ? » (aide immédiate, comme sur IOS), Ctrl+Z, Ctrl+C.
 * Utilisé pour la console du switch (IOS) et pour l'invite de commandes Windows.
 */
import { el } from '../ui/dom';

export interface TerminalBackend {
  prompt(): string;
  exec(line: string): { out: string; clear?: boolean; close?: boolean };
  complete?(line: string): string;
  help?(line: string): string;
  /** Ctrl+Z (IOS : « end »). */
  ctrlZ?(): string;
  busy?(): boolean;
  banner?: string;
  theme: 'ios' | 'cmd';
  /**
   * Mémoire persistante (historique ↑/↓ + contenu de l'écran), partagée entre
   * plusieurs ouvertures du même terminal : on la retrouve en revenant.
   */
  store?: TerminalStore;
}

export interface TerminalStore {
  history: string[];
  transcript: string;
}

const stores = new Map<string, TerminalStore>();

/** Mémoire d'un terminal identifié par une clé (ex. « ios:SW-01 », « cmd:PC-COMPTA-01 »). */
export function terminalStore(key: string): TerminalStore {
  let s = stores.get(key);
  if (!s) stores.set(key, (s = { history: [], transcript: '' }));
  return s;
}

/** Efface toutes les mémoires (nouvelle partie). */
export function resetTerminalStores(): void {
  stores.clear();
}

export function createTerminal(backend: TerminalBackend, onClose?: () => void): { root: HTMLElement; focus: () => void; refresh: () => void } {
  const root = el('div', { class: `term term-${backend.theme}` });
  const out = el('pre', { class: 'term-out' });
  const line = el('div', { class: 'term-line' });
  const promptEl = el('span', { class: 'term-prompt' });
  const input = el('input', { class: 'term-input', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
  line.append(promptEl, input);
  root.append(out, line);
  const store = backend.store ?? { history: [], transcript: '' };
  const history = store.history;
  let hIndex = history.length;

  const print = (text: string) => {
    if (!text) return;
    out.textContent += (out.textContent ? '\n' : '') + text;
    // On garde les 400 dernières lignes à l'écran (et en mémoire).
    const lines = out.textContent!.split('\n');
    if (lines.length > 400) out.textContent = lines.slice(-400).join('\n');
    store.transcript = out.textContent!;
  };
  const scroll = () => (root.scrollTop = root.scrollHeight);
  const refresh = () => {
    const busy = backend.busy?.() ?? false;
    promptEl.textContent = busy ? '' : backend.prompt();
    input.disabled = busy;
    line.classList.toggle('busy', busy);
    scroll();
  };
  if (store.transcript) out.textContent = store.transcript;
  else if (backend.banner) print(backend.banner);
  refresh();

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') e.stopPropagation();
    if (e.key === 'Enter') {
      const v = input.value;
      print(promptEl.textContent + v);
      input.value = '';
      if (v.trim() && history[history.length - 1] !== v) history.push(v);
      if (history.length > 100) history.shift();
      hIndex = history.length;
      const r = backend.exec(v);
      if (r.clear) {
        out.textContent = '';
        store.transcript = '';
      }
      print(r.out);
      refresh();
      if (r.close) onClose?.();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (backend.complete) input.value = backend.complete(input.value);
    } else if (e.key === '?' && backend.help) {
      // Comme sur IOS : « ? » affiche l'aide sans valider la ligne.
      e.preventDefault();
      print(promptEl.textContent + input.value + '?');
      print(backend.help(input.value));
      refresh();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIndex > 0) input.value = history[--hIndex];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hIndex = Math.min(history.length, hIndex + 1);
      input.value = history[hIndex] ?? '';
    } else if (e.key.toLowerCase() === 'z' && e.ctrlKey && backend.ctrlZ) {
      e.preventDefault();
      print(promptEl.textContent + '^Z');
      print(backend.ctrlZ());
      refresh();
    } else if (e.key.toLowerCase() === 'c' && e.ctrlKey) {
      e.preventDefault();
      print(promptEl.textContent + input.value + '^C');
      input.value = '';
      refresh();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.textContent = '';
      store.transcript = '';
    }
  });
  root.addEventListener('click', () => input.focus());
  return { root, focus: () => setTimeout(() => input.focus(), 30), refresh };
}
