import { defineScenario } from '../../tickets/types';
import { isCompta } from './helpers';

/** La VLAN 30 (imprimantes) a été retirée des VLAN autorisées sur le trunk SW-01 ↔ SW-02. */
export default defineScenario({
  id: 'trunk-vlan',
  minLevel: 3,
  category: 'Réseau',
  priority: 3,
  titles: ['Impossible d’imprimer depuis la compta (les autres services OK ?)', 'Imprimante injoignable'],
  descriptions: ['L’imprimante ne répond plus depuis la compta. Bizarrement, l’imprimante est bien allumée et son port est bon. {prenom}'],
  eligible: isCompta,
  inject: (ctx) => {
    ctx.net.state.switches['SW-01'].running.ports['Gi0/2'].allowedVlans = [1, 10, 20, 99];
    ctx.net.changed();
  },
  isResolved: (ctx, t) => ctx.office.printProblems(t.host, 'IMP-COMPTA').length === 0,
  dialog: {
    describe: ['Tout le reste marche, internet, le serveur… seulement l’imprimante.'],
    before: ['Le prestataire réseau a « sécurisé les trunks » hier.'],
  },
  clues: ['SW-02 Fa0/2 est bien en VLAN 30', 'show interfaces trunk sur SW-01 : Gi0/2 n’autorise que 1,10,20,99', 'Le routeur est sur SW-01, l’imprimante sur SW-02'],
  solution: 'La VLAN 30 ne traverse plus le trunk entre SW-01 et SW-02. Sur SW-01 : int gi0/2, switchport trunk allowed vlan add 30, end, wr. Vérifier avec show interfaces trunk.',
  xp: 90,
  solve: (ctx) => {
    ctx.net.state.switches['SW-01'].running.ports['Gi0/2'].allowedVlans = null;
    ctx.net.changed();
  },
});
