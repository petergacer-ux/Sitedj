import { defineScenario } from '../../tickets/types';
import { isCommercial } from './helpers';

/** VPN qui ne se connecte pas en télétravail (ticket par téléphone) : utilisateur absent du groupe GG_VPN. */
export default defineScenario({
  id: 'vpn',
  minLevel: 2,
  category: 'Téléphonie',
  priority: 3,
  channel: 'phone',
  titles: ['VPN impossible en télétravail', 'Erreur 812 VPN'],
  descriptions: ['Appel de {prenom} en télétravail : le VPN refuse de se connecter, « erreur 812 : la connexion a été bloquée par une stratégie ». Il a une démo client à 14h.'],
  eligible: (ctx, u) => isCommercial(ctx, u) && !!ctx.office.user(u.id)?.groups.includes('GG_VPN'),
  inject: (ctx, t) => {
    ctx.office.removeFromGroup(t.user, 'GG_VPN');
  },
  isResolved: (ctx, t) => {
    const u = ctx.office.user(t.user)!;
    return u.groups.includes('GG_VPN') && u.enabled && !u.locked && !u.passwordExpired;
  },
  dialog: {
    describe: ['Le VPN me met « erreur 812 : la connexion a été bloquée par une stratégie configurée sur votre serveur RAS/VPN ».'],
    before: ['Ça marchait la semaine dernière ! Il y a eu la migration des groupes, non ?'],
  },
  clues: ['Erreur 812 = la stratégie réseau (NPS) refuse : l’utilisateur n’est pas dans le groupe autorisé', 'net user login /domain : GG_VPN absent'],
  solution: 'Console AD : ajouter l’utilisateur au groupe GG_VPN. Lui demander de se reconnecter au VPN. (À distance : pas besoin de redémarrer, le VPN relit les groupes à chaque connexion.)',
  xp: 55,
  solve: (ctx, t) => ctx.office.addToGroup(t.user, 'GG_VPN'),
});
