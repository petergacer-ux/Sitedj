import { splitRef } from '../../network/Network';
import { defineScenario } from '../../tickets/types';
import { expectedVlan, hostOk, switchPortOfDesk } from './helpers';

/** « J'ai une adresse en 169.254 » → le port est retombé dans la VLAN 1 (pas de DHCP). */
export default defineScenario({
  id: 'apipa',
  minLevel: 1,
  category: 'Réseau',
  priority: 3,
  titles: ['Adresse en 169.254', 'Réseau non identifié'],
  descriptions: [
    'Mon PC me dit « Réseau non identifié – pas d’accès internet ». J’ai fait ipconfig comme on m’a appris et j’ai une adresse en 169.254… {prenom}',
  ],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    const [sw, p] = splitRef(switchPortOfDesk(ctx, t.desk)!);
    ctx.net.state.switches[sw].running.ports[p].accessVlan = 1;
    ctx.net.changed();
  },
  isResolved: (ctx, t) => hostOk(ctx, t),
  dialog: {
    describe: ['Il y a un petit triangle jaune sur l’icône réseau.'],
    before: ['Hier il y avait des travaux dans la salle serveur, je crois.'],
  },
  clues: ['ipconfig : 169.254.x.x (APIPA) = aucun serveur DHCP n’a répondu', 'show vlan brief : le port est dans la VLAN 1 (default)'],
  solution: 'Une adresse APIPA signifie que le DHCP ne répond pas : vérifier le port du switch (shutdown ? bonne VLAN ?). Ici : switchport access vlan <bonne VLAN>, puis ipconfig /renew.',
  xp: 55,
  solve: (ctx, t) => {
    const [sw, p] = splitRef(switchPortOfDesk(ctx, t.desk)!);
    ctx.net.state.switches[sw].running.ports[p].accessVlan = expectedVlan(t.desk);
    ctx.net.changed();
  },
});
