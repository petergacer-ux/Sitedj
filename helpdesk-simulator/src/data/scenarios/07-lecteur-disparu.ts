import { defineScenario } from '../../tickets/types';

/** « Le lecteur S: a disparu » → net use ou gpupdate /force. */
export default defineScenario({
  id: 'lecteur-disparu',
  minLevel: 0,
  category: 'Logiciel',
  priority: 2,
  titles: ['Le lecteur S: a disparu', 'Plus de lecteur réseau S'],
  descriptions: ['Bonjour, le lecteur S: a disparu de mon poste de travail, je n’ai plus accès aux dossiers du service. {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id) && !!ctx.office.pc(ctx.office.hostOf(u.id)!)?.drives.some((d) => d.letter === 'S:'),
  inject: (ctx, t) => {
    const pc = ctx.office.pc(t.host)!;
    t.data.path = pc.drives.find((d) => d.letter === 'S:')!.path;
    pc.drives = pc.drives.filter((d) => d.letter !== 'S:');
    ctx.office.changed();
  },
  isResolved: (ctx, t) => ctx.office.driveWorks(t.host, 'S:'),
  dialog: {
    describe: ['Dans « Ce PC », il n’y a plus que C: et P:. Le S: n’est plus là.'],
    before: ['J’ai fait un clic droit dessus et « Déconnecter » parce qu’il était lent… c’est grave ?'],
  },
  clues: ['net use : S: absent', 'Le poste a bien le réseau et l’utilisateur est dans le bon groupe'],
  solution: 'Dans l’invite de commandes du poste : gpupdate /force (la GPO remappe les lecteurs), ou net use S: \\\\SRV-FICHIERS\\<Service>. Vérifier ensuite dans l’Explorateur.',
  xp: 30,
  solve: (ctx, t) => {
    ctx.office.gpupdate(t.host);
  },
});
