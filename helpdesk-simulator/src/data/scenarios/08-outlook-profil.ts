import { defineScenario } from '../../tickets/types';

/** Outlook ne s'ouvre plus → profil corrompu à recréer. */
export default defineScenario({
  id: 'outlook-profil',
  minLevel: 0,
  category: 'Messagerie',
  priority: 3,
  titles: ['Outlook ne s’ouvre plus', 'Messagerie plantée'],
  descriptions: ['Outlook ne veut plus s’ouvrir, ça met un message d’erreur et ça se ferme. Je ne reçois plus mes mails !! {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    ctx.office.pc(t.host)!.outlook.profileCorrupt = true;
    ctx.office.changed();
  },
  isResolved: (ctx, t) => !ctx.office.pc(t.host)!.outlook.profileCorrupt,
  dialog: {
    describe: ['Ça dit « Impossible de démarrer Microsoft Outlook. Impossible d’ouvrir la fenêtre Outlook ».'],
    before: ['Le PC s’est éteint d’un coup hier pendant qu’Outlook était ouvert, il y a eu une coupure de courant.'],
  },
  clues: ['Message : « Impossible d’ouvrir la fenêtre Outlook. Le jeu de dossiers ne peut pas être ouvert »', 'Le webmail fonctionne : le compte n’est pas en cause'],
  solution: 'Sur le poste : Outlook → Panneau de configuration Courrier → Afficher les profils → créer un nouveau profil (le compte Exchange se configure tout seul), le définir par défaut, relancer Outlook.',
  xp: 35,
  solve: (ctx, t) => {
    ctx.office.pc(t.host)!.outlook.profileCorrupt = false;
  },
});
