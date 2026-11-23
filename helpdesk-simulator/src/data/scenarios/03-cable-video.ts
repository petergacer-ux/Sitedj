import { defineScenario } from '../../tickets/types';
import { pick } from './helpers';

/** Écran noir « Aucun signal » → câble vidéo débranché, ou écran HS à remplacer. */
export default defineScenario({
  id: 'ecran-noir',
  minLevel: 0,
  category: 'Matériel',
  priority: 2,
  titles: ['Ecran noir "aucun signal"', 'Mon écran affiche aucun signal'],
  descriptions: ['Bonjour, depuis ce matin mon écran affiche « Aucun signal » puis s’éteint. Le PC a l’air allumé. {prenom}'],
  inject: (ctx, t) => {
    const pc = ctx.office.pc(t.host)!;
    t.data.cause = pick(ctx, ['cable', 'cable', 'dead']);
    if (t.data.cause === 'cable') pc.videoCable = false;
    else pc.monitorDead = true;
    ctx.office.changed();
  },
  isResolved: (ctx, t) => {
    const pc = ctx.office.pc(t.host)!;
    return pc.videoCable && !pc.monitorDead;
  },
  dialog: {
    describe: ['Ça affiche « Aucun signal » dans un petit cadre bleu, puis ça s’éteint.'],
    before: ['J’ai déplacé ma tour pour brancher mon chargeur de téléphone derrière.', 'Il a fait un drôle de bruit hier soir, un petit « clac ».'],
  },
  clues: ['« Aucun signal » = l’écran ne reçoit rien du PC', 'Vérifier l’arrière de l’unité centrale (câble HDMI)', 'Si l’écran ne s’allume plus du tout : écran à remplacer (stock)'],
  solution: 'Regarder l’arrière de l’unité centrale : rebrancher le câble vidéo (HDMI). Si l’écran reste mort, prendre un écran de remplacement dans le stock et l’échanger.',
  xp: 35,
  solve: (ctx, t) => {
    const pc = ctx.office.pc(t.host)!;
    pc.videoCable = true;
    pc.monitorDead = false;
  },
});
