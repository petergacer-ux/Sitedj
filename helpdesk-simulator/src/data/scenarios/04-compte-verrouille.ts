import { defineScenario } from '../../tickets/types';

/** « Mon compte est bloqué » → déverrouiller le compte AD et réinitialiser le mot de passe. */
export default defineScenario({
  id: 'compte-verrouille',
  minLevel: 0,
  category: 'Compte/AD',
  priority: 3,
  channel: 'phone',
  titles: ['Compte bloqué', 'Je n’arrive plus à me connecter'],
  descriptions: [
    'J’ai oublié mon mot de passe, j’ai essayé plusieurs fois et maintenant ça dit que mon compte est verrouillé. Je peux plus rien faire. {prenom}',
  ],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    const u = ctx.office.user(t.user)!;
    u.locked = true;
    t.data.since = Date.now();
    ctx.office.changed();
  },
  isResolved: (ctx, t) => {
    const u = ctx.office.user(t.user)!;
    return !u.locked && u.enabled && u.passwordResetAt !== null && u.passwordResetAt >= Number(t.data.since) && u.mustChangePassword;
  },
  dialog: {
    describe: ['Ça me dit « Le compte référencé est actuellement verrouillé ». Et j’ai oublié mon mot de passe de toute façon…'],
    before: ['Je l’avais changé vendredi, et lundi matin… trou noir. J’ai dû essayer cinq ou six fois.'],
  },
  clues: ['Écran de connexion : « compte verrouillé »', 'net user login /domain → Compte : Verrouillé'],
  solution: 'Dans la console Active Directory : rechercher l’utilisateur, déverrouiller le compte, réinitialiser le mot de passe en cochant « L’utilisateur doit changer le mot de passe à la prochaine ouverture de session ». Communiquer le mot de passe provisoire de vive voix.',
  xp: 40,
  solve: (ctx, t) => {
    ctx.office.unlock(t.user);
    ctx.office.resetPassword(t.user, 'Provisoire2026', true);
  },
});
