import { defineScenario } from '../../tickets/types';

/** Prêt d'un ordinateur portable avec fiche de prêt. */
export default defineScenario({
  id: 'pret-portable',
  minLevel: 1,
  category: 'Matériel',
  priority: 2,
  titles: ['Besoin d’un portable pour un déplacement', 'Demande de prêt PC portable'],
  descriptions: ['Bonjour, je pars en salon professionnel jeudi et vendredi, est-ce que je pourrais avoir un portable de prêt ? {prenom}'],
  eligible: (ctx, u) => !ctx.office.state.loans.some((l) => l.user === u.id && !l.returned),
  inject: () => {},
  isResolved: (ctx, t) => ctx.office.state.loans.some((l) => l.user === t.user && l.delivered && !l.returned),
  dialog: {
    describe: ['Il me faudrait un portable avec Outlook et le VPN pour deux jours.'],
    before: ['Mon PC fixe ne bouge pas, hein, c’est juste pour le salon.'],
  },
  clues: ['Un portable de prêt est disponible dans le stock', 'La fiche de prêt se remplit dans HelpDesk Pro → Prêts'],
  solution: 'Prendre un portable de prêt dans l’étagère, remplir la fiche de prêt dans HelpDesk Pro (utilisateur, matériel, n° de série, dates, état), puis remettre le portable à l’utilisateur (lui parler avec le portable en main).',
  xp: 35,
  solve: (ctx, t) => {
    ctx.office.state.loans.push({ id: ctx.office.state.nextLoanId++, user: t.user, item: 'Portable de prêt', serial: 'PRET-01', from: 'jeudi', to: 'vendredi', condition: 'Bon état', delivered: true, returned: false });
  },
});
