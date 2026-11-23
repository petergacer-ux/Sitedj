import { defineScenario } from '../../tickets/types';

/** Le directeur veut que ce soit réglé « tout de suite » : son imprimante par défaut a changé. */
export default defineScenario({
  id: 'directeur',
  minLevel: 1,
  category: 'Impression',
  priority: 4,
  channel: 'phone',
  titles: ['URGENT DIRECTION : impossible d’imprimer', 'Impression CODIR'],
  descriptions: ['Je n’arrive pas à imprimer les documents du CODIR qui commence dans 15 minutes. Ça m’ouvre une fenêtre pour « enregistrer sous ». Réglez ça TOUT DE SUITE. P. Lambert'],
  eligible: (_ctx, u) => u.service === 'Direction',
  inject: (ctx, t) => {
    ctx.office.pc(t.host)!.defaultPrinter = 'Microsoft Print to PDF';
    ctx.office.changed();
  },
  isResolved: (ctx, t) => ctx.office.pc(t.host)!.defaultPrinter === 'HP-DIR' && ctx.office.printProblems(t.host, 'HP-DIR').length === 0,
  dialog: {
    describe: ['Quand je clique sur Imprimer, ça me demande où enregistrer un fichier PDF ! Je veux du PAPIER.', 'Je n’ai pas le temps, faites vite.'],
    before: ['Mon assistante a imprimé un PDF depuis mon poste hier, c’est peut-être elle.'],
  },
  clues: ['L’imprimante par défaut est « Microsoft Print to PDF »', 'L’imprimante HP-DIR fonctionne'],
  solution: 'Sur le poste du directeur : Imprimantes → HP-DIR → « Définir par défaut ». Imprimer une page test devant lui. Priorité très haute : y aller immédiatement.',
  xp: 45,
  solve: (ctx, t) => {
    ctx.office.pc(t.host)!.defaultPrinter = 'HP-DIR';
  },
});
