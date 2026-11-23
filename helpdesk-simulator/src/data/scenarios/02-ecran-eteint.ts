import { defineScenario } from '../../tickets/types';

/** Faux ticket : « mon ordinateur ne s'allume plus » → l'écran était simplement éteint. */
export default defineScenario({
  id: 'ecran-eteint',
  minLevel: 0,
  category: 'Matériel',
  priority: 3,
  titles: ['URGENT mon ordinateur ne s’allume plus', 'PC mort ???', 'Ecran tout noir'],
  descriptions: [
    'Mon ordi ne s’allume plus du tout, l’écran reste noir !!! J’ai une présentation à finir, c’est très urgent. {prenom}',
    'Ecran noir depuis que je suis revenue de pause. J’ai appuyé sur toutes les touches. {prenom}',
  ],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    ctx.office.pc(t.host)!.monitorOn = false;
    ctx.office.changed();
  },
  isResolved: (ctx, t) => ctx.office.pc(t.host)!.monitorOn,
  dialog: {
    describe: ['L’écran est tout noir, rien ne s’affiche. Par contre la tour fait du bruit, c’est normal ?'],
    before: ['J’ai fait un peu de ménage sur mon bureau, j’ai essuyé l’écran avec une lingette.'],
  },
  clues: ['La LED verte de la tour est allumée : le PC tourne', 'L’écran est noir, sans message « Aucun signal »'],
  solution: 'Vérifier les évidences : la tour est allumée, l’écran est simplement éteint. Appuyer sur le bouton d’alimentation de l’écran. Expliquer gentiment à l’utilisateur.',
  xp: 25,
  solve: (ctx, t) => {
    ctx.office.pc(t.host)!.monitorOn = true;
  },
});
