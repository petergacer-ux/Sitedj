import { defineScenario } from '../../tickets/types';

/** Boîte aux lettres pleine : plus de réception de mails. */
export default defineScenario({
  id: 'bal-pleine',
  minLevel: 0,
  category: 'Messagerie',
  priority: 2,
  titles: ['Je ne reçois plus de mails', 'Message « boîte pleine »'],
  descriptions: ['Un client me dit que ses mails me reviennent avec une erreur, et Outlook me met un bandeau rouge. {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    ctx.office.pc(t.host)!.outlook.mailboxUsage = 100;
    ctx.office.changed();
  },
  isResolved: (ctx, t) => ctx.office.pc(t.host)!.outlook.mailboxUsage < 90,
  dialog: {
    describe: ['Il y a un bandeau rouge en haut d’Outlook qui parle de quota.'],
    before: ['Je garde tout, on ne sait jamais. J’ai des pièces jointes de 2019 !'],
  },
  clues: ['Outlook : « Votre boîte aux lettres est pleine » (100 % du quota)', 'Les expéditeurs reçoivent un message de non-remise'],
  solution: 'Dans Outlook : archiver les anciens éléments (Fichier → Outils de nettoyage → Archiver) et vider les éléments supprimés. Le quota doit repasser sous 90 %.',
  xp: 25,
  solve: (ctx, t) => {
    ctx.office.pc(t.host)!.outlook.mailboxUsage = 55;
  },
});
