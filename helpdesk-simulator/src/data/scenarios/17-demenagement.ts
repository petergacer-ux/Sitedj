import { defineScenario } from '../../tickets/types';
import { hostOk } from './helpers';

/** « J'ai plus le réseau depuis le déménagement » → la prise n'est plus brassée dans la baie. */
export default defineScenario({
  id: 'demenagement',
  minLevel: 1,
  category: 'Réseau',
  priority: 3,
  titles: ['Plus de réseau depuis le déménagement de bureau', 'Nouveau bureau sans réseau'],
  descriptions: ['On m’a changé de place ce matin (bureau {bureau}) et depuis j’ai plus le réseau. Le câble est branché dans la prise du mur. {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    const pp = ctx.net.state.horizontal[`${t.desk}:jack`];
    const c = ctx.net.cableAt(pp);
    if (c) {
      t.data.port = c.a === pp ? String(c.b) : c.a;
      ctx.net.disconnect(c.id);
    }
  },
  isResolved: (ctx, t) => hostOk(ctx, t),
  dialog: {
    describe: ['Le câble est bien dans la prise murale, j’ai vérifié.'],
    before: ['Les services généraux ont déplacé tout le monde ce week-end. Ils ont dit que l’informatique « brancherait » les prises.'],
  },
  clues: ['ipconfig : Média déconnecté', 'Baie : le port du panneau correspondant à la prise n’a pas de cordon', 'Survoler le panneau de brassage pour retrouver la prise'],
  solution: 'Dans la baie, repérer le port du panneau de brassage relié à la prise du bureau, et poser un cordon vers un port du switch configuré dans la bonne VLAN (vérifier au survol).',
  xp: 60,
  solve: (ctx, t) => {
    ctx.net.connect(ctx.net.state.horizontal[`${t.desk}:jack`], String(t.data.port), { kind: 'patch', length: 1 });
  },
});
