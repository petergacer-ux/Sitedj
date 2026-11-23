import { defineScenario } from '../../tickets/types';
import { hostOk } from './helpers';

/** IP statique erronée saisie par l'utilisateur. */
export default defineScenario({
  id: 'ip-statique',
  minLevel: 1,
  category: 'Réseau',
  priority: 2,
  titles: ['Plus internet après manip', 'J’ai changé un réglage réseau'],
  descriptions: ['Mon neveu m’a configuré une IP fixe sur le portable pour la box à la maison, je l’ai reproduit sur le PC du bureau et maintenant plus rien… {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    ctx.net.state.hosts[t.host].ip = { mode: 'static', ip: '192.168.1.50', mask: '255.255.255.0', gateway: '192.168.1.1', dns: '192.168.1.1' };
    ctx.net.changed();
  },
  isResolved: (ctx, t) => hostOk(ctx, t) || (ctx.net.host(t.host)!.ip.mode === 'static' && ctx.net.ping(t.host, '192.168.99.10').result === 'ok' && ctx.net.ping(t.host, '8.8.8.8').result === 'ok'),
  dialog: {
    describe: ['Ça marche plus du tout depuis que j’ai mis l’adresse de la maison.'],
    before: ['J’ai mis 192.168.1.50, c’est ce que mon neveu avait mis.'],
  },
  clues: ['ipconfig : 192.168.1.50 / passerelle 192.168.1.1 — pas le bon réseau', 'ping de la passerelle : « Impossible de joindre l’hôte de destination »'],
  solution: 'Paramètres réseau → IPv4 → « Obtenir une adresse IP automatiquement » (DHCP) et DNS automatique. Vérifier avec ipconfig et un ping de SRV-FICHIERS.',
  xp: 45,
  solve: (ctx, t) => {
    ctx.net.state.hosts[t.host].ip = { mode: 'dhcp', ip: '', mask: '', gateway: '', dns: '' };
    ctx.net.changed();
  },
});
