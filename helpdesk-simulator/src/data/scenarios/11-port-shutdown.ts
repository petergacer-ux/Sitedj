import { splitRef } from '../../network/Network';
import { defineScenario } from '../../tickets/types';
import { hostOk, switchPortOfDesk } from './helpers';

/** Port du switch désactivé (shutdown) : « média déconnecté » alors que le câble est branché. */
export default defineScenario({
  id: 'port-shutdown',
  minLevel: 1,
  category: 'Réseau',
  priority: 3,
  titles: ['Câble réseau débranché ??? alors qu’il est branché', 'Pas de réseau, le câble est bien branché'],
  descriptions: ['Windows me dit « câble réseau débranché » mais j’ai vérifié, il est bien branché ! J’ai même rebranché 2 fois. {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    const [sw, p] = splitRef(switchPortOfDesk(ctx, t.desk)!);
    ctx.net.state.switches[sw].running.ports[p].shutdown = true;
    t.data.port = `${sw}:${p}`;
    ctx.net.changed();
  },
  isResolved: (ctx, t) => hostOk(ctx, t),
  dialog: {
    describe: ['La petite lumière derrière le PC, à côté du câble, elle est éteinte.'],
    before: ['Rien du tout, je suis arrivée, c’était comme ça.'],
  },
  clues: ['ipconfig : « Média déconnecté »', 'Le câble et la prise sont bons', 'LED du port éteinte dans la baie', 'show interfaces status : « disabled »'],
  solution: 'Identifier le port (survol du panneau de brassage). En CLI : conf t, int fa0/x, no shutdown, end, wr. La LED repasse au vert.',
  xp: 60,
  solve: (ctx, t) => {
    const [sw, p] = splitRef(String(t.data.port));
    ctx.net.state.switches[sw].running.ports[p].shutdown = false;
    ctx.net.changed();
  },
});
