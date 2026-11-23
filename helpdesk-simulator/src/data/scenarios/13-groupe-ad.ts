import { defineScenario } from '../../tickets/types';
import { isCompta } from './helpers';

/** « Impossible d'accéder au dossier Compta » → utilisateur absent du groupe GG_Compta. */
export default defineScenario({
  id: 'groupe-ad',
  minLevel: 1,
  category: 'Compte/AD',
  priority: 3,
  titles: ['Impossible d’accéder au dossier Compta', 'Accès refusé au lecteur S:'],
  descriptions: ['Je n’ai plus accès au dossier Compta, ça me met « accès refusé ». Je dois clôturer le mois aujourd’hui !! {prenom}'],
  eligible: isCompta,
  inject: (ctx, t) => {
    ctx.office.removeFromGroup(t.user, 'GG_Compta');
    const pc = ctx.office.pc(t.host)!;
    pc.sessionGroups = pc.sessionGroups.filter((g) => g !== 'GG_Compta');
    pc.drives = pc.drives.filter((d) => d.letter !== 'S:');
    ctx.office.changed();
  },
  isResolved: (ctx, t) => ctx.office.user(t.user)!.groups.includes('GG_Compta') && ctx.office.driveWorks(t.host, 'S:'),
  dialog: {
    describe: ['Le lecteur S: n’apparaît plus, et quand je tape \\\\SRV-FICHIERS\\Compta ça dit accès refusé.'],
    before: ['Les RH ont fait le ménage dans les comptes la semaine dernière, à cause des stagiaires.'],
  },
  clues: ['net use S: \\\\SRV-FICHIERS\\Compta → Erreur système 5 : accès refusé', 'net user login /domain : GG_Compta absent', 'Après l’ajout au groupe, il faut fermer la session (ou redémarrer) pour obtenir le nouveau jeton'],
  solution: 'Console AD : ajouter l’utilisateur au groupe GG_Compta. Puis sur le poste : redémarrer (ou fermer/rouvrir la session) — le jeton de groupes n’est relu qu’à l’ouverture de session — la GPO remappe S:.',
  xp: 65,
  solve: (ctx, t) => {
    ctx.office.addToGroup(t.user, 'GG_Compta');
    ctx.office.reboot(t.host, 0, 0);
    ctx.office.tick(1);
  },
});
