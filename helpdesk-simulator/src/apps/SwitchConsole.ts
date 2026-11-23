/** Console série d'un switch (câble console bleu) ou session SSH depuis le poste helpdesk. */
import { IosCli } from '../cli/IosCli';
import type { Network } from '../network/Network';
import { createTerminal } from './Terminal';

const sessions = new Map<string, IosCli>();

/** Une session CLI par switch (le mode et l'historique sont conservés entre deux ouvertures). */
export function cliFor(net: Network, switchId: string, onReload: () => void): IosCli {
  let s = sessions.get(switchId);
  if (!s) {
    s = new IosCli(net, switchId, { onReload });
    sessions.set(switchId, s);
  }
  return s;
}

export function resetCliSessions(): void {
  sessions.clear();
}

export function buildSwitchConsole(net: Network, switchId: string, onReload: () => void, via: 'console' | 'ssh', onClose?: () => void) {
  const cli = cliFor(net, switchId, onReload);
  if (via === 'ssh' && cli.mode === 'user') cli.mode = 'user';
  const banner =
    via === 'console'
      ? `Connexion console (9600 bauds) à ${switchId}…\n\nUser Access Verification\n\nPress RETURN to get started.\n`
      : `login as: admin\nadmin@${net.state.switches[switchId].running.mgmt?.ip}'s password: ********\n\n${switchId} - Acces reserve au service informatique\n`;
  const term = createTerminal(
    {
      theme: 'ios',
      banner,
      prompt: () => cli.prompt,
      exec: (line) => {
        const out = cli.exec(line);
        const close = cli.mode === 'user' && /^\s*exit\s*$/i.test(line) && via === 'ssh';
        return { out, close };
      },
      complete: (l) => cli.complete(l),
      help: (l) => cli.help(l),
      ctrlZ: () => {
        if (cli.mode !== 'user' && cli.mode !== 'priv') cli.mode = 'priv';
        return '';
      },
      busy: () => cli.busy,
    },
    onClose,
  );
  // Pendant un redémarrage, on rafraîchit l'invite pour la réactiver à la fin.
  const timer = setInterval(() => {
    if (!term.root.isConnected) clearInterval(timer);
    else term.refresh();
  }, 500);
  term.focus();
  return term;
}
