import { defineScenario } from '../../tickets/types';
import { hostOk } from './helpers';

/** Câble défectueux (une paire coupée) : tester puis remplacer. */
export default defineScenario({
  id: 'cable-hs',
  minLevel: 1,
  category: 'Matériel',
  priority: 3,
  titles: ['Réseau qui coupe tout le temps', 'Plus de réseau'],
  descriptions: ['Le réseau marchait par intermittence depuis 2 jours, et là plus rien du tout. {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    const c = ctx.net.cableAt(`${t.host}:eth0`);
    if (c) c.fault = 'open';
    ctx.net.changed();
  },
  isResolved: (ctx, t) => hostOk(ctx, t) && ctx.net.cableAt(`${t.host}:eth0`)?.fault === 'none',
  dialog: {
    describe: ['Ça coupait quand je bougeais ma chaise, maintenant ça ne revient plus.'],
    before: ['Ma chaise roule sur le câble toute la journée, il est un peu écrasé.'],
  },
  clues: ['Le câble est bien branché mais « Média déconnecté »', 'Testeur de câble : une paire coupée', 'Le port du switch est actif (no shutdown)'],
  solution: 'Tester le câble avec le testeur (paire coupée). Prendre un câble RJ45 neuf dans le stock et l’utiliser sur la prise pour remplacer le câble défectueux.',
  xp: 55,
  solve: (ctx, t) => {
    ctx.net.cableAt(`${t.host}:eth0`)!.fault = 'none';
    ctx.net.changed();
  },
});
