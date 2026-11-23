import { defineScenario } from '../../tickets/types';
import { isCompta } from './helpers';

/** Toner vide sur l'imprimante réseau de la Compta. */
export default defineScenario({
  id: 'toner-vide',
  minLevel: 0,
  category: 'Impression',
  priority: 2,
  titles: ['Impressions toutes blanches', 'Imprimante : remplacer toner'],
  descriptions: ['Les feuilles sortent presque blanches et l’imprimante affiche un voyant orange. {prenom}'],
  eligible: isCompta,
  inject: (ctx) => {
    ctx.office.state.printers['IMP-COMPTA'].toner = 0;
    ctx.office.changed();
  },
  isResolved: (ctx) => ctx.office.state.printers['IMP-COMPTA'].toner > 50,
  dialog: {
    describe: ['Ça sort tout pâle, et maintenant plus rien du tout. Il y a un message sur le petit écran de l’imprimante.'],
    before: ['On imprime beaucoup en fin de mois, c’est la clôture.'],
  },
  clues: ['Écran de l’imprimante : « Remplacer la cartouche de toner »', 'Gestionnaire d’impression : niveau de toner 0 %'],
  solution: 'Prendre un toner noir dans le stock du helpdesk, aller à l’imprimante IMP-COMPTA et utiliser le toner dessus (E avec le toner en main).',
  xp: 25,
  solve: (ctx) => {
    ctx.office.state.printers['IMP-COMPTA'].toner = 100;
  },
});
