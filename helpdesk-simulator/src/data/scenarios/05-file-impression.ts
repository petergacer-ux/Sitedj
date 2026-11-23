import { defineScenario } from '../../tickets/types';
import { isCompta } from './helpers';

/** « L'imprimante n'imprime plus » → un document en erreur bloque la file d'attente. */
export default defineScenario({
  id: 'file-impression',
  minLevel: 0,
  category: 'Impression',
  priority: 2,
  titles: ['L’imprimante n’imprime plus', 'Impression bloquée'],
  descriptions: ['Mes impressions ne sortent plus sur l’imprimante de la compta, j’ai relancé 4 fois mon document. Ça reste « en attente ». {prenom}'],
  eligible: isCompta,
  inject: (ctx, t) => {
    const p = ctx.office.state.printers['IMP-COMPTA'];
    const u = ctx.office.user(t.user)!;
    p.stuck = true;
    p.queue = [
      { doc: 'Relevé_bancaire_mars.pdf', owner: u.login, status: 'Erreur - Impression' },
      { doc: 'Facture_F2026-0412.pdf', owner: u.login, status: 'En attente' },
      { doc: 'Facture_F2026-0412.pdf', owner: u.login, status: 'En attente' },
      { doc: 'Note de frais.xlsx', owner: 'kbenali', status: 'En attente' },
    ];
    ctx.office.changed();
  },
  isResolved: (ctx) => !ctx.office.state.printers['IMP-COMPTA'].stuck,
  dialog: {
    describe: ['Ça reste « en attente » dans la liste, et rien ne sort.', 'L’imprimante a l’air allumée pourtant, elle affiche « Prête ».'],
    before: ['J’ai imprimé un gros PDF de la banque, 80 pages, et depuis plus rien.'],
  },
  clues: ['Gestionnaire d’impression : un document « Erreur - Impression » en tête de file', 'L’imprimante répond au ping'],
  solution: 'Sur le poste, ouvrir Imprimantes → IMP-COMPTA → Annuler tous les documents (purger la file), puis relancer une impression test.',
  xp: 30,
  solve: (ctx) => ctx.office.purgeQueue('IMP-COMPTA'),
});
