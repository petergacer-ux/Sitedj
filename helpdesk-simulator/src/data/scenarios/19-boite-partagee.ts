import { defineScenario } from '../../tickets/types';
import { isCommercial } from './helpers';

/** Ajout d'une boîte mail partagée : droits AD + ajout dans Outlook. */
export default defineScenario({
  id: 'boite-partagee',
  minLevel: 1,
  category: 'Messagerie',
  priority: 1,
  titles: ['Ajouter la boîte commercial@', 'Accès boîte partagée commercial'],
  descriptions: ['Bonjour, ma responsable souhaite que j’aie accès à la boîte commercial@entreprise.fr pour répondre aux demandes de devis. Merci. {prenom}'],
  eligible: (ctx, u) => isCommercial(ctx, u) && !ctx.office.user(u.id)?.groups.includes('GG_BAL_Commercial'),
  inject: () => {},
  isResolved: (ctx, t) => ctx.office.user(t.user)!.groups.includes('GG_BAL_Commercial') && ctx.office.pc(t.host)!.outlook.shared.includes('commercial@entreprise.fr'),
  dialog: {
    describe: ['Il me faudrait la boîte commercial@ dans mon Outlook, à côté de la mienne.'],
    before: ['C’est validé par ma responsable, elle vous a mis en copie normalement.'],
  },
  clues: ['Le droit d’accès passe par le groupe AD GG_BAL_Commercial', 'Sans le groupe, Outlook refuse d’ouvrir la boîte'],
  solution: 'Console AD : ajouter l’utilisateur au groupe GG_BAL_Commercial. Puis sur son poste : Outlook → Paramètres du compte → Ajouter une boîte partagée → commercial@entreprise.fr.',
  xp: 40,
  solve: (ctx, t) => {
    ctx.office.addToGroup(t.user, 'GG_BAL_Commercial');
    ctx.office.pc(t.host)!.outlook.shared.push('commercial@entreprise.fr');
  },
});
