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
}

export function createTerminal(backend: TerminalBackend, onClose?: () => void): { root: HTMLElement; focus: () => void; refresh: () => void } {
  const root = el('div', { class: `term term-${backend.theme}` });
  const out = el('pre', { class: 'term-out' });
  const line = el('div', { class: 'term-line' });
  const promptEl = el('span', { class: 'term-prompt' });
  const input = el('input', { class: 'term-input', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
  line.append(promptEl, input);
  root.append(out, line);
  const history: string[] = [];
  let hIndex = 0;

  const print = (text: string) => {
    if (!text) return;
    out.textContent += (out.textContent ? '\n' : '') + text;
  };
  const scroll = () => (root.scrollTop = root.scrollHeight);
  const refresh = () => {
    const busy = backend.busy?.() ?? false;
    promptEl.textContent = busy ? '' : backend.prompt();
    input.disabled = busy;
    line.classList.toggle('busy', busy);
    scroll();
  };
  if (backend.banner) print(backend.banner);
  refresh();

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') e.stopPropagation();
    if (e.key === 'Enter') {
      const v = input.value;
      print(promptEl.textContent + v);
      input.value = '';
      if (v.trim()) history.push(v);
      hIndex = history.length;
      const r = backend.exec(v);
      if (r.clear) out.textContent = '';
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
    }
  });
  root.addEventListener('click', () => input.focus());
  return { root, focus: () => setTimeout(() => input.focus(), 30), refresh };
}
