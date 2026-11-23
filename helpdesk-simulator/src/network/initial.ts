/**
 * Réseau de départ de l'entreprise (piloté par les données du plan).
 *
 * VLAN : 1 (défaut), 10 UTILISATEURS, 20 COMPTA, 30 IMPRIMANTES, 99 ADMINISTRATION.
 * Adressage : 192.168.<vlan>.0/24, passerelle .254 (sous-interfaces du routeur RT-FW-01),
 * DHCP sur SRV-01 (192.168.99.10) relayé par le routeur.
 *
 * Topologie de la baie :
 *   RT-FW-01 Gi0/0 ══trunk══ SW-01 Gi0/1        SW-01 Gi0/2 ══trunk══ SW-02 Gi0/1
 *   SRV-01 eth0 ── SW-02 Fa0/24 (VLAN 99)
 *   Prises B-01…B-11 → PP-01:1…11 → SW-01 Fa0/1…11      B-12 → PP-01:12 (NON BRASSÉE : nouveau poste)
 *   HD-01 (helpdesk) → PP-01:13 → SW-02 Fa0/1 (VLAN 99)  P-01 (imprimante Compta) → PP-01:14 → SW-02 Fa0/2 (VLAN 30)
 */
import { DESKS, MY_DESK } from '../data/map';
import { macFor } from './ip';
import { clone, defaultPort } from './Network';
import type { HostState, NetworkState, SwitchConfig, SwitchState } from './types';

export const VLANS: Record<number, string> = {
  1: 'default',
  10: 'UTILISATEURS',
  20: 'COMPTA',
  30: 'IMPRIMANTES',
  99: 'ADMINISTRATION',
};

/** VLAN attendue selon le service du bureau. */
export function vlanForRoom(room: string): number {
  return room === 'compta' ? 20 : 10;
}

function switchConfig(hostname: string, mgmtIp: string): SwitchConfig {
  const ports: SwitchConfig['ports'] = {};
  for (let i = 1; i <= 24; i++) ports[`Fa0/${i}`] = defaultPort();
  ports['Gi0/1'] = defaultPort();
  ports['Gi0/2'] = defaultPort();
  return {
    hostname,
    vlans: { ...VLANS },
    ports,
    mgmt: { vlan: 99, ip: mgmtIp, mask: '255.255.255.0', gateway: '192.168.99.254' },
  };
}

function makeSwitch(id: string, cfg: SwitchConfig): SwitchState {
  return { id, running: cfg, startup: clone(cfg), errDisabled: [], rebooting: false };
}

function pc(id: string, kind: HostState['kind'] = 'pc', ip?: Partial<HostState['ip']>): HostState {
  return {
    id,
    kind,
    mac: macFor(id),
    nic: 'eth0',
    nicEnabled: true,
    powered: true,
    ip: { mode: 'dhcp', ip: '', mask: '', gateway: '', dns: '', ...ip },
  };
}

export function createInitialNetwork(): NetworkState {
  // ---- SW-01 : postes utilisateurs
  const sw1 = switchConfig('SW-01', '192.168.99.2');
  DESKS.forEach((d, i) => {
    if (i >= 11) return; // B-12 : prise pas encore brassée
    const p = sw1.ports[`Fa0/${i + 1}`];
    p.accessVlan = vlanForRoom(d.room);
    p.description = `Bureau ${d.id}`;
  });
  // Ports de réserve prêts à l'emploi
  for (let i = 12; i <= 16; i++) Object.assign(sw1.ports[`Fa0/${i}`], { accessVlan: 10, description: 'Reserve UTILISATEURS' });
  for (let i = 17; i <= 20; i++) Object.assign(sw1.ports[`Fa0/${i}`], { accessVlan: 20, description: 'Reserve COMPTA' });
  for (let i = 21; i <= 24; i++) Object.assign(sw1.ports[`Fa0/${i}`], { shutdown: true, description: 'Non utilise' });
  Object.assign(sw1.ports['Gi0/1'], { mode: 'trunk', description: 'Uplink RT-FW-01' });
  Object.assign(sw1.ports['Gi0/2'], { mode: 'trunk', description: 'Trunk SW-02' });

  // ---- SW-02 : admin, imprimantes, serveurs
  const sw2 = switchConfig('SW-02', '192.168.99.3');
  Object.assign(sw2.ports['Fa0/1'], { accessVlan: 99, description: 'Helpdesk HD-01' });
  Object.assign(sw2.ports['Fa0/2'], { accessVlan: 30, description: 'Imprimante IMP-COMPTA' });
  for (let i = 3; i <= 8; i++) Object.assign(sw2.ports[`Fa0/${i}`], { accessVlan: 30, description: 'Reserve IMPRIMANTES' });
  for (let i = 9; i <= 20; i++) Object.assign(sw2.ports[`Fa0/${i}`], { accessVlan: 99, description: 'Reserve ADMIN' });
  Object.assign(sw2.ports['Fa0/24'], { accessVlan: 99, description: 'SRV-01' });
  Object.assign(sw2.ports['Gi0/1'], { mode: 'trunk', description: 'Trunk SW-01' });

  // ---- Hôtes
  const hosts: Record<string, HostState> = {};
  for (const d of DESKS) hosts[d.pcName] = pc(d.pcName);
  hosts[MY_DESK.pcName] = pc(MY_DESK.pcName);
  hosts['SRV-01'] = pc('SRV-01', 'server', { mode: 'static', ip: '192.168.99.10', mask: '255.255.255.0', gateway: '192.168.99.254', dns: '127.0.0.1' });
  hosts['IMP-COMPTA'] = pc('IMP-COMPTA', 'printer', { mode: 'static', ip: '192.168.30.10', mask: '255.255.255.0', gateway: '192.168.30.254', dns: '192.168.99.10' });
  // Le poste B-12 (nouvel arrivant) est éteint
  const newPc = DESKS.find((d) => !d.userId);
  if (newPc) hosts[newPc.pcName].powered = false;

  // ---- Câblage horizontal (dans les murs) : prise → port du panneau
  const horizontal: Record<string, string> = {};
  DESKS.forEach((d, i) => (horizontal[`${d.id}:jack`] = `PP-01:${i + 1}`));
  horizontal['HD-01:jack'] = 'PP-01:13';
  horizontal['P-01:jack'] = 'PP-01:14';

  const state: NetworkState = {
    version: 0,
    switches: { 'SW-01': makeSwitch('SW-01', sw1), 'SW-02': makeSwitch('SW-02', sw2) },
    routers: {
      'RT-FW-01': {
        id: 'RT-FW-01',
        subifs: [10, 20, 30, 99].map((v) => ({
          parent: 'Gi0/0',
          vlan: v,
          ip: `192.168.${v}.254`,
          mask: '255.255.255.0',
          helper: v === 99 ? null : '192.168.99.10',
        })),
      },
    },
    hosts,
    horizontal,
    cables: [],
    dhcp: {
      server: 'SRV-01',
      scopes: [10, 20, 30, 99].map((v) => ({
        vlan: v,
        network: `192.168.${v}.0`,
        mask: '255.255.255.0',
        start: v === 99 ? 100 : 20,
        end: v === 99 ? 150 : 200,
        gateway: `192.168.${v}.254`,
        dns: '192.168.99.10',
      })),
      leases: {},
    },
    nextCableId: 1,
  };

  const cable = (a: string, b: string, kind: 'patch' | 'drop', color: string, length: number) =>
    state.cables.push({ id: `C${state.nextCableId++}`, kind, a, b, color, length, fault: 'none' });

  // Câbles des postes (PC → prise)
  for (const d of DESKS) cable(`${d.pcName}:eth0`, `${d.id}:jack`, 'drop', 'bleu', 3);
  cable(`${MY_DESK.pcName}:eth0`, 'HD-01:jack', 'drop', 'bleu', 3);
  cable('IMP-COMPTA:eth0', 'P-01:jack', 'drop', 'gris', 2);
  // Brassage dans la baie
  DESKS.forEach((d, i) => {
    if (i < 11) cable(`PP-01:${i + 1}`, `SW-01:Fa0/${i + 1}`, 'patch', vlanForRoom(d.room) === 20 ? 'vert' : 'bleu', 0.5);
  });
  cable('PP-01:13', 'SW-02:Fa0/1', 'patch', 'rouge', 0.5);
  cable('PP-01:14', 'SW-02:Fa0/2', 'patch', 'jaune', 0.5);
  cable('SRV-01:eth0', 'SW-02:Fa0/24', 'patch', 'rouge', 1);
  cable('RT-FW-01:Gi0/0', 'SW-01:Gi0/1', 'patch', 'noir', 0.5);
  cable('SW-01:Gi0/2', 'SW-02:Gi0/1', 'patch', 'noir', 0.5);
  return state;
}
