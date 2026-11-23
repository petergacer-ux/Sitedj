import { defineScenario } from '../../tickets/types';
import { hostOk } from './helpers';

/** Carte réseau désactivée dans Windows. */
export default defineScenario({
  id: 'carte-desactivee',
  minLevel: 1,
  category: 'Réseau',
  priority: 3,
  titles: ['Plus de connexion réseau', 'Le réseau a disparu de mon PC'],
  descriptions: ['J’ai voulu réparer mon wifi chez moi le week-end dernier et depuis au bureau j’ai plus de réseau du tout. {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    ctx.net.state.hosts[t.host].nicEnabled = false;
    ctx.net.changed();
  },
  isResolved: (ctx, t) => hostOk(ctx, t),
  dialog: {
    describe: ['Il n’y a même plus l’icône Ethernet, juste une mappemonde barrée.'],
    before: ['Sur un forum, ils disaient de « désactiver puis réactiver la carte ». J’ai juste fait la première partie…'],
  },
  clues: ['ipconfig : aucune carte Ethernet listée', 'La LED du port reste éteinte', 'Paramètres réseau : carte « Désactivée »'],
  solution: 'Sur le poste : Paramètres réseau → Modifier les options d’adaptateur → Ethernet → Activer.',
  xp: 45,
  solve: (ctx, t) => {
    ctx.net.state.hosts[t.host].nicEnabled = true;
    ctx.net.changed();
  },
});
