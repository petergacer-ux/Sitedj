/**
 * Types du moteur réseau. Tout l'état est sérialisable en JSON (sauvegarde).
 *
 * Chemin physique d'un poste :
 *   PC (eth0) ─câble─ prise murale (B-12) ═câblage horizontal═ panneau de brassage (PP-01:12) ─cordon─ switch (Fa0/5)
 * La prise et le panneau sont PASSIFS : ils prolongent le lien. Si un maillon manque, pas de lien.
 */

/** Référence de port : « équipement:port », ex. « SW-01:Fa0/5 », « PP-01:12 », « B-12:jack », « PC-COMPTA-01:eth0 ». */
export type PortRef = string;

export type CableFault = 'none' | 'open' | 'short' | 'crossed';

export interface Cable {
  id: string;
  kind: 'patch' | 'drop';
  a: PortRef;
  /** null = extrémité débranchée (le câble pend). */
  b: PortRef | null;
  color: string;
  length: number;
  fault: CableFault;
}

export type SwitchportMode = 'access' | 'trunk';

export interface SwitchPortConfig {
  shutdown: boolean;
  mode: SwitchportMode;
  accessVlan: number;
  nativeVlan: number;
  /** null = toutes les VLAN autorisées sur le trunk. */
  allowedVlans: number[] | null;
  description: string;
}

export interface SwitchConfig {
  hostname: string;
  vlans: Record<number, string>;
  ports: Record<string, SwitchPortConfig>;
  /** Interface de management (SVI). */
  mgmt: { vlan: number; ip: string; mask: string; gateway: string } | null;
}

export interface SwitchState {
  id: string;
  running: SwitchConfig;
  startup: SwitchConfig;
  /** Ports passés en err-disable (boucle, port-security…). */
  errDisabled: string[];
  /** Le switch est en train de redémarrer. */
  rebooting: boolean;
}

export interface RouterSubif {
  /** Interface physique porteuse, ex. « Gi0/0 ». */
  parent: string;
  vlan: number;
  ip: string;
  mask: string;
  /** Relais DHCP (ip helper-address). */
  helper: string | null;
}

export interface RouterState {
  id: string;
  subifs: RouterSubif[];
}

export interface IpConfig {
  mode: 'dhcp' | 'static';
  ip: string;
  mask: string;
  gateway: string;
  dns: string;
}

export type HostKind = 'pc' | 'server' | 'printer';

export interface HostState {
  id: string; // nom réseau, ex. PC-COMPTA-01
  kind: HostKind;
  mac: string;
  /** Port physique de l'hôte (eth0). */
  nic: string;
  nicEnabled: boolean;
  powered: boolean;
  ip: IpConfig;
}

export interface DhcpScope {
  vlan: number;
  network: string; // 192.168.10.0
  mask: string;
  start: number; // dernier octet de début
  end: number;
  gateway: string;
  dns: string;
}

export interface NetworkState {
  version: number;
  switches: Record<string, SwitchState>;
  routers: Record<string, RouterState>;
  hosts: Record<string, HostState>;
  /** Câblage horizontal (dans les murs) : prise → port du panneau. */
  horizontal: Record<string, PortRef>;
  cables: Cable[];
  dhcp: { server: string; scopes: DhcpScope[]; leases: Record<string, string> };
  nextCableId: number;
}

/** Résultat « ipconfig » d'un hôte. */
export interface HostIpInfo {
  status: 'off' | 'disabled' | 'disconnected' | 'apipa' | 'dhcp' | 'static';
  ip: string | null;
  mask: string | null;
  gateway: string | null;
  dns: string | null;
  /** VLAN du segment où se trouve l'hôte (null si pas de lien). */
  vlan: number | null;
}

export type SwitchPortStatus = 'connected' | 'notconnect' | 'disabled' | 'err-disabled' | 'inactive';
