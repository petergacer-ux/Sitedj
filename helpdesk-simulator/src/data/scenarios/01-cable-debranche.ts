import { defineScenario } from '../../tickets/types';
import { hostOk } from './helpers';

/** « Internet ne marche plus » → le câble réseau a été débranché sous le bureau. */
export default defineScenario({
  id: 'cable-debranche',
  minLevel: 0,
  category: 'Réseau',
  priority: 3,
  titles: ['Internet marche plus', 'Plus de réseau !!', 'Pas internet depuis ce matin'],
  descriptions: [
    'Bonjour, internet marche plus du tout sur mon PC depuis tout à l’heure. J’ai rien touché. Merci de venir vite. {prenom}',
    'Bjr, j’ai plus internet, ni les mails ni rien, ya une croix rouge en bas a droite. {prenom} ({bureau})',
  ],
  inject: (ctx, t) => {
    const c = ctx.net.cableAt(`${t.host}:eth0`);
    if (c) ctx.net.unplug(c.id);
  },
  isResolved: (ctx, t) => hostOk(ctx, t),
  dialog: {
    describe: ['Ben depuis tout à l’heure j’ai une petite croix rouge sur l’écran en bas à droite.', 'Plus rien ne marche : ni internet, ni Outlook, ni le serveur.'],
    before: ['J’ai passé l’aspirateur sous mon bureau ce matin… enfin la femme de ménage, je crois.', 'J’ai juste poussé mon pied sous le bureau, pourquoi ?'],
  },
  clues: ['L’icône réseau affiche une croix rouge', 'ipconfig : « Média déconnecté »', 'La LED du port du switch est éteinte', 'Le câble traîne par terre sous le bureau'],
  solution: 'Se baisser sous le bureau (C), vérifier la prise murale et rebrancher le câble RJ45 du PC. Vérifier ensuite avec ipconfig que le poste a une adresse IP.',
  xp: 40,
  solve: (ctx, t) => {
    const c = ctx.net.cableAt(`${t.host}:eth0`)!;
    ctx.net.plug(c.id, `${t.desk}:jack`);
  },
});
