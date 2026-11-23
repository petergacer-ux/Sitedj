import { splitRef } from '../../network/Network';
import { defineScenario } from '../../tickets/types';
import { expectedVlan, hostOk, isCompta, switchPortOfDesk } from './helpers';

/** Le port du switch d'un comptable a été mis dans la VLAN UTILISATEURS : plus d'accès au logiciel de compta. */
export default defineScenario({
  id: 'vlan-errone',
  minLevel: 1,
  category: 'Réseau',
  priority: 3,
  titles: ['Logiciel de compta inaccessible', 'SAGE ne se connecte plus'],
  descriptions: ['Le logiciel de compta me dit « serveur introuvable » depuis ce matin. Internet marche par contre. Ma collègue n’a pas le problème. {prenom}'],
  eligible: isCompta,
  inject: (ctx, t) => {
    const port = switchPortOfDesk(ctx, t.desk)!;
    const [sw, p] = splitRef(port);
    ctx.net.state.switches[sw].running.ports[p].accessVlan = 10;
    ctx.net.changed();
  },
  isResolved: (ctx, t) => hostOk(ctx, t),
  dialog: {
    describe: ['Internet fonctionne, mais le logiciel de compta ne trouve plus son serveur.'],
    before: ['Un prestataire est passé hier soir dans le local technique, il a « fait du rangement » dans le switch.'],
  },
  clues: ['ipconfig : adresse en 192.168.10.x au lieu de 192.168.20.x', 'show vlan brief : le port est dans la VLAN 10', 'Le serveur de compta n’accepte que la VLAN 20'],
  solution: 'Repérer le port du switch (panneau de brassage → switch). En CLI : enable, conf t, interface fa0/x, switchport access vlan 20, end, write memory. Puis ipconfig /renew sur le poste.',
  xp: 60,
  solve: (ctx, t) => {
    const [sw, p] = splitRef(switchPortOfDesk(ctx, t.desk)!);
    ctx.net.state.switches[sw].running.ports[p].accessVlan = expectedVlan(t.desk);
    ctx.net.changed();
  },
});
