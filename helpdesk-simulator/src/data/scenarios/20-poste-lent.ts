import { defineScenario } from '../../tickets/types';

/** Poste très lent → seulement 4 Go de RAM : ajouter une barrette. */
export default defineScenario({
  id: 'poste-lent',
  minLevel: 1,
  category: 'Matériel',
  priority: 1,
  titles: ['PC super lent', 'Mon ordinateur rame'],
  descriptions: ['Mon PC est d’une lenteur… Excel met 2 minutes à s’ouvrir et tout freeze quand j’ai Teams en même temps. {prenom}'],
  eligible: (ctx, u) => !!ctx.office.hostOf(u.id),
  inject: (ctx, t) => {
    ctx.office.pc(t.host)!.ramGb = 4;
    ctx.office.changed();
  },
  isResolved: (ctx, t) => ctx.office.pc(t.host)!.ramGb >= 8,
  dialog: {
    describe: ['Tout est lent : Excel, Teams, Outlook… Le ventilateur souffle fort.'],
    before: ['On m’a échangé ma tour pendant les vacances, l’ancienne était en panne.'],
  },
  clues: ['systeminfo : Mémoire physique totale 4 096 Mo', 'Gestionnaire des tâches : mémoire à 95 %'],
  solution: 'Vérifier la RAM (systeminfo). Prendre une barrette 8 Go et le tournevis dans le stock, ouvrir l’unité centrale (arrière du PC) et ajouter la barrette.',
  xp: 50,
  solve: (ctx, t) => {
    ctx.office.pc(t.host)!.ramGb = 12;
  },
});
