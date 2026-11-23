import { defineScenario } from '../../tickets/types';

/** Mail suspect signalé → ne pas cliquer, signaler et bloquer l'expéditeur. */
export default defineScenario({
  id: 'phishing',
  minLevel: 1,
  category: 'Sécurité',
  priority: 3,
  titles: ['Mail bizarre de la banque', 'Mail suspect : est-ce que je clique ?'],
  descriptions: ['J’ai reçu un mail de « la banque » qui me demande de confirmer mes identifiants sinon le compte de l’entreprise est bloqué. Je clique ? {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    const pc = ctx.office.pc(t.host)!;
    pc.outlook.mails.unshift({
      id: 'phish',
      from: 'service-client@banque-securite-fr.com',
      subject: 'URGENT : Votre compte professionnel sera suspendu sous 24h',
      body:
        'Cher client,\n\nSuite à une activité inhabituelle, votre accès professionnel sera SUSPENDU dans les 24 heures.\nVeuillez confirmer immédiatement vos identifiants en cliquant sur le lien ci-dessous :\n\nhttp://banque-secure-verif.com/connexion\n\nCordialement,\nLe service sécurité',
      date: "Aujourd'hui 09:14",
      phishing: { clues: ['domain', 'urgency', 'link', 'credentials'], reported: false, clicked: false },
    });
    t.data.since = Date.now();
    ctx.office.changed();
  },
  isResolved: (ctx, t) => {
    const pc = ctx.office.pc(t.host)!;
    const all = Object.values(ctx.office.state.pcs).flatMap((p) => p.outlook.mails);
    const m = pc.outlook.mails.find((x) => x.id === 'phish') ?? all.find((x) => x.id === 'phish');
    const reported = !m || !!m.phishing?.reported;
    const blocked = pc.outlook.blocked.includes('service-client@banque-securite-fr.com');
    const clicked = !!m?.phishing?.clicked;
    const u = ctx.office.user(t.user)!;
    // Si quelqu'un a cliqué, il faut en plus réinitialiser le mot de passe du compte.
    return reported && blocked && (!clicked || (u.passwordResetAt !== null && u.passwordResetAt >= Number(t.data.since)));
  },
  dialog: {
    describe: ['Le mail dit que le compte sera bloqué dans 24 heures si je ne confirme pas mes identifiants.'],
    before: ['Je n’ai encore rien fait, j’ai préféré demander. J’ai bien fait ?'],
  },
  clues: ['Domaine de l’expéditeur différent du vrai domaine de la banque', 'Ton urgent et menaçant', 'Lien vers un site inconnu', 'Demande d’identifiants par mail'],
  solution: 'Ne JAMAIS cliquer. Dans Outlook : « Signaler comme hameçonnage » et « Bloquer l’expéditeur ». Féliciter l’utilisateur d’avoir prévenu. Si quelqu’un a cliqué : réinitialiser son mot de passe dans l’AD.',
  xp: 60,
  solve: (ctx, t) => {
    const pc = ctx.office.pc(t.host)!;
    pc.outlook.mails.find((x) => x.id === 'phish')!.phishing!.reported = true;
    pc.outlook.blocked.push('service-client@banque-securite-fr.com');
  },
});
