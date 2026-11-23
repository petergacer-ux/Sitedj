import { DESKS } from '../map';
import { defineScenario } from '../../tickets/types';
import { hostOk } from './helpers';

/**
 * Le switch SW-01 a redémarré (coupure électrique) : la config d'hier soir n'avait pas été sauvegardée
 * (write memory oublié). Les ports Fa0/3 et Fa0/4 de la Compta sont retombés en VLAN 1 → deux tickets.
 */
export default defineScenario({
  id: 'config-perdue',
  minLevel: 2,
  category: 'Réseau',
  priority: 3,
  titles: ['Plus de réseau à la compta après la coupure', 'Réseau HS depuis la coupure de courant'],
  descriptions: ['Depuis la coupure de courant de cette nuit, je n’ai plus de réseau (adresse bizarre en 169.254). {prenom}'],
  eligible: (_ctx, u) => u.id === 'slefevre',
  extraTargets: () => {
    const d = DESKS.find((x) => x.userId === 'mdubois')!;
    return [{ user: 'mdubois', host: d.pcName, desk: d.id, data: {} }];
  },
  inject: (ctx) => {
    const sw = ctx.net.state.switches['SW-01'];
    // La startup-config date d'avant le passage des ports en VLAN 20
    for (const p of ['Fa0/3', 'Fa0/4']) {
      sw.startup.ports[p].accessVlan = 1;
      sw.startup.ports[p].description = '';
    }
    ctx.net.startReboot('SW-01');
    ctx.net.finishReboot('SW-01');
  },
  isResolved: (ctx, t) => {
    const sw = ctx.net.state.switches['SW-01'];
    const port = t.desk === 'B-03' ? 'Fa0/3' : 'Fa0/4';
    return hostOk(ctx, t) && sw.startup.ports[port].accessVlan === 20;
  },
  dialog: {
    describe: ['Le PC dit « réseau non identifié ». Marc à côté a pareil.'],
    before: ['Il y a eu une coupure de courant cette nuit, les lumières clignotaient ce matin.'],
  },
  clues: ['Plusieurs postes de la Compta touchés en même temps', 'show vlan brief : Fa0/3 et Fa0/4 en VLAN 1', 'show startup-config : la config sauvegardée ne contient pas la VLAN 20 sur ces ports', 'L’onduleur ne protège pas le switch contre un redémarrage long'],
  solution: 'Reconfigurer les ports (interface range fa0/3 - 4, switchport access vlan 20) puis SURTOUT sauvegarder : copy running-config startup-config (ou write memory), sinon la config sera encore perdue au prochain redémarrage.',
  xp: 80,
  solve: (ctx) => {
    const sw = ctx.net.state.switches['SW-01'];
    for (const p of ['Fa0/3', 'Fa0/4']) sw.running.ports[p].accessVlan = 20;
    ctx.net.writeMemory('SW-01');
  },
});
