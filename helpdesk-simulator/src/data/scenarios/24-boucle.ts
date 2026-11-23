import { DESKS } from '../map';
import { defineScenario } from '../../tickets/types';

/**
 * Un commercial a branché un petit switch personnel sur DEUX prises murales (B-07 et B-08) :
 * boucle de niveau 2 → tempête de broadcast dans toute la VLAN 10.
 */
export default defineScenario({
  id: 'boucle',
  minLevel: 2,
  category: 'Réseau',
  priority: 4,
  titles: ['Réseau très lent / coupé pour tout le service commercial', 'Plus de réseau pour TOUT le monde'],
  descriptions: [
    'Tout le service commercial n’a plus de réseau depuis 10 minutes, ou alors c’est extrêmement lent. C’est la panique, on a des clients au téléphone. {prenom}',
  ],
  eligible: (_ctx, u) => u.id === 'npetit',
  inject: (ctx) => {
    const net = ctx.net;
    net.state.switches['SW-PERSO'] = {
      id: 'SW-PERSO',
      unmanaged: true,
      rebooting: false,
      errDisabled: [],
      running: { hostname: 'SW-PERSO', vlans: { 1: 'default' }, ports: {}, mgmt: null },
      startup: { hostname: 'SW-PERSO', vlans: { 1: 'default' }, ports: {}, mgmt: null },
    };
    for (let i = 1; i <= 5; i++) {
      net.state.switches['SW-PERSO'].running.ports[`p${i}`] = { shutdown: false, mode: 'access', accessVlan: 1, nativeVlan: 1, allowedVlans: null, description: '' };
    }
    net.state.switches['SW-PERSO'].startup = JSON.parse(JSON.stringify(net.state.switches['SW-PERSO'].running));
    const pc7 = DESKS.find((d) => d.id === 'B-07')!.pcName;
    const pc8 = DESKS.find((d) => d.id === 'B-08')!.pcName;
    for (const pc of [pc7, pc8]) {
      const c = net.cableAt(`${pc}:eth0`);
      if (c) net.state.cables = net.state.cables.filter((x) => x !== c);
    }
    net.connect(`${pc7}:eth0`, 'SW-PERSO:p1', { kind: 'drop', length: 2 });
    net.connect(`${pc8}:eth0`, 'SW-PERSO:p2', { kind: 'drop', length: 2 });
    net.connect('SW-PERSO:p4', 'B-07:jack', { kind: 'drop', length: 2, color: 'jaune' });
    net.connect('SW-PERSO:p5', 'B-08:jack', { kind: 'drop', length: 2, color: 'jaune' });
  },
  isResolved: (ctx) => {
    const ok = (h: string) => {
      const ip = ctx.net.hostIp(h);
      return ip.status === 'dhcp' && ip.vlan === 10;
    };
    return !ctx.net.portInLoop('SW-01', 'Fa0/7') && !ctx.net.portInLoop('SW-01', 'Fa0/8') && ok('PC-COM-01') && ok('PC-COM-03');
  },
  dialog: {
    describe: ['Ça a commencé d’un coup, pour tout le monde en même temps.'],
    before: ['J’ai juste installé un petit switch sous mon bureau pour brancher mon imprimante perso et le PC de Camille. Pourquoi ?'],
  },
  clues: ['Toute la VLAN 10 est touchée, la VLAN 20 non', 'Baie : les LED des ports Fa0/7 et Fa0/8 clignotent en orange très vite (tempête)', 'Sous le bureau B-07 : un petit switch branché sur deux prises murales'],
  solution: 'Boucle réseau : un petit switch relié à deux prises du même réseau. Débrancher un des deux câbles du mini-switch à la prise murale (B-07 ou B-08), ou couper un des ports en CLI (shutdown). Bonne pratique : activer « spanning-tree bpduguard enable » sur les ports utilisateurs.',
  xp: 90,
  solve: (ctx) => {
    const c = ctx.net.cableAt('B-08:jack');
    if (c) ctx.net.disconnect(c.id);
  },
});
