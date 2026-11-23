import { defineScenario } from '../../tickets/types';
import { isCompta } from './helpers';

/** L'imprimante réseau a été changée de VLAN sur le switch : injoignable (IP statique en 192.168.30.x). */
export default defineScenario({
  id: 'imprimante-vlan',
  minLevel: 2,
  category: 'Impression',
  priority: 3,
  titles: ['Imprimante compta : plus personne ne peut imprimer', 'Imprimante hors ligne'],
  descriptions: ['Plus personne à la compta ne peut imprimer, Windows dit que l’imprimante est « hors connexion ». Elle est allumée pourtant. {prenom}'],
  eligible: isCompta,
  inject: (ctx) => {
    ctx.net.state.switches['SW-02'].running.ports['Fa0/2'].accessVlan = 10;
    ctx.net.changed();
  },
  isResolved: (ctx, t) => ctx.office.printProblems(t.host, 'IMP-COMPTA').length === 0,
  dialog: {
    describe: ['L’imprimante affiche « Prête » sur son écran, mais sur le PC elle est « hors connexion ».'],
    before: ['Quelqu’un est venu configurer le switch pour le nouveau bureau ce matin.'],
  },
  clues: ['ping 192.168.30.10 : délai d’attente dépassé', 'La prise P-01 est brassée sur SW-02 Fa0/2', 'show vlan brief sur SW-02 : Fa0/2 dans la VLAN 10 au lieu de 30'],
  solution: 'L’imprimante a une IP statique en 192.168.30.x : son port doit être dans la VLAN 30 (IMPRIMANTES). Sur SW-02 : int fa0/2, switchport access vlan 30, end, wr.',
  xp: 75,
  solve: (ctx) => {
    ctx.net.state.switches['SW-02'].running.ports['Fa0/2'].accessVlan = 30;
    ctx.net.changed();
  },
});
