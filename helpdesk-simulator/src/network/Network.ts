/**
 * Moteur réseau simplifié mais cohérent — indépendant de Three.js.
 *
 * - Couche 1 : on suit les câbles de port en port ; prises murales et panneau de brassage sont passifs.
 *   Un lien est « up » si tous les câbles sont sains et les deux extrémités actives allumées.
 * - Couche 2 : chaque lien relie des « nœuds VLAN » (sw:SW-01:10, rt:RT-FW-01:20, host:PC-X…)
 *   selon le mode access/trunk des ports (trames étiquetées ou non). Les composantes connexes
 *   du graphe sont les domaines de diffusion.
 * - Couche 3 : DHCP (direct ou via le relais du routeur), APIPA, ping avec passerelle et routage inter-VLAN.
 */
import { apipaFor, intToIp, ipToInt, macFor, sameSubnet } from './ip';
import type {
  Cable,
  CableFault,
  DhcpScope,
  HostIpInfo,
  HostState,
  NetworkState,
  PortRef,
  SwitchConfig,
  SwitchPortConfig,
  SwitchPortStatus,
} from './types';

export interface TraceResult {
  /** Port actif à l'autre bout (null si la chaîne est coupée). */
  end: PortRef | null;
  cables: Cable[];
  /** Raison d'une coupure : pas de câble, câble débranché, prise non câblée. */
  broken: 'nocable' | 'loose' | 'unwired' | null;
  /** Port où la chaîne s'arrête. */
  stoppedAt: PortRef | null;
}

export interface LinkInfo {
  up: boolean;
  peer: PortRef | null;
  cables: Cable[];
  reason: 'ok' | 'nocable' | 'loose' | 'unwired' | 'fault' | 'admin-down' | 'peer-down';
}

export type PingResult =
  | { result: 'ok'; ttl: number }
  | { result: 'timeout' }
  | { result: 'unreachable'; from: string }
  | { result: 'general' };

interface Endpoint {
  id: string;
  ip: string;
  mask: string;
  gateway: string | null;
  comp: number;
  apipa: boolean;
}

export function splitRef(ref: PortRef): [string, string] {
  const i = ref.indexOf(':');
  return [ref.slice(0, i), ref.slice(i + 1)];
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function defaultPort(): SwitchPortConfig {
  return { shutdown: false, mode: 'access', accessVlan: 1, nativeVlan: 1, allowedVlans: null, description: '' };
}

export class Network {
  state: NetworkState;
  private listeners = new Set<() => void>();
  private cache: { version: number; parent: Map<string, string>; compIds: Map<string, number> } | null = null;

  constructor(state: NetworkState) {
    this.state = state;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** À appeler après toute modification de l'état. */
  changed(): void {
    this.state.version++;
    this.cache = null;
    this.listeners.forEach((fn) => fn());
  }

  load(state: NetworkState): void {
    this.state = state;
    this.changed();
  }

  // ================================================================ câblage

  isPatchPanel(device: string): boolean {
    return device.startsWith('PP-');
  }

  isJack(device: string): boolean {
    return `${device}:jack` in this.state.horizontal;
  }

  isPassive(ref: PortRef): boolean {
    const [d] = splitRef(ref);
    return this.isPatchPanel(d) || this.isJack(d);
  }

  cableAt(ref: PortRef): Cable | undefined {
    return this.state.cables.find((c) => c.a === ref || c.b === ref);
  }

  isFree(ref: PortRef): boolean {
    return !this.cableAt(ref);
  }

  /** Prise murale reliée à un port du panneau (câblage horizontal). */
  jackForPanelPort(ref: PortRef): PortRef | null {
    for (const [jack, pp] of Object.entries(this.state.horizontal)) if (pp === ref) return jack;
    return null;
  }

  connect(
    a: PortRef,
    b: PortRef,
    opts: { kind?: Cable['kind']; color?: string; length?: number; fault?: CableFault } = {},
  ): { ok: true; cable: Cable } | { ok: false; error: string } {
    if (a === b) return { ok: false, error: 'Impossible de relier un port à lui-même.' };
    if (!this.portExists(a) || !this.portExists(b)) return { ok: false, error: 'Port inconnu.' };
    if (!this.isFree(a)) return { ok: false, error: `Le port ${a} est déjà occupé.` };
    if (!this.isFree(b)) return { ok: false, error: `Le port ${b} est déjà occupé.` };
    const cable: Cable = {
      id: `C${this.state.nextCableId++}`,
      kind: opts.kind ?? 'patch',
      a,
      b,
      color: opts.color ?? 'bleu',
      length: opts.length ?? 1,
      fault: opts.fault ?? 'none',
    };
    this.state.cables.push(cable);
    this.changed();
    return { ok: true, cable };
  }

  disconnect(cableId: string): void {
    const i = this.state.cables.findIndex((c) => c.id === cableId);
    if (i >= 0) {
      this.state.cables.splice(i, 1);
      this.changed();
    }
  }

  /** Débranche l'extrémité « b » d'un câble (ex. câble du PC retiré de la prise). */
  unplug(cableId: string): void {
    const c = this.state.cables.find((x) => x.id === cableId);
    if (c && c.b) {
      c.b = null;
      this.changed();
    }
  }

  /** Rebranche l'extrémité libre d'un câble sur un port. */
  plug(cableId: string, ref: PortRef): boolean {
    const c = this.state.cables.find((x) => x.id === cableId);
    if (!c || c.b || !this.isFree(ref)) return false;
    c.b = ref;
    this.changed();
    return true;
  }

  portExists(ref: PortRef): boolean {
    const [d, p] = splitRef(ref);
    if (this.isPatchPanel(d)) return /^\d+$/.test(p) && Number(p) >= 1 && Number(p) <= 24;
    if (this.isJack(d)) return p === 'jack';
    const sw = this.state.switches[d];
    if (sw) return p in sw.running.ports;
    if (this.state.routers[d]) return /^Gi0\/[0-3]$/.test(p);
    const h = this.state.hosts[d];
    if (h) return p === h.nic || (h.kind === 'server' && p === 'eth1');
    return false;
  }

  /** Suit les câbles depuis un port actif jusqu'au prochain port actif. */
  trace(from: PortRef): TraceResult {
    const cables: Cable[] = [];
    let cur = from;
    for (let guard = 0; guard < 12; guard++) {
      const cable = this.cableAt(cur);
      if (!cable) return { end: null, cables, broken: 'nocable', stoppedAt: cur };
      cables.push(cable);
      const other = cable.a === cur ? cable.b : cable.a;
      if (other === null) return { end: null, cables, broken: 'loose', stoppedAt: cur };
      if (!this.isPassive(other)) return { end: other, cables, broken: null, stoppedAt: null };
      // Traversée d'un élément passif : prise ⇄ panneau via le câblage horizontal.
      const [d] = splitRef(other);
      const next = this.isJack(d) ? this.state.horizontal[other] : this.jackForPanelPort(other);
      if (!next) return { end: null, cables, broken: 'unwired', stoppedAt: other };
      cur = next;
    }
    return { end: null, cables, broken: 'unwired', stoppedAt: cur };
  }

  /** L'extrémité active est-elle administrativement allumée ? */
  adminUp(ref: PortRef): boolean {
    const [d, p] = splitRef(ref);
    const sw = this.state.switches[d];
    if (sw) {
      const cfg = sw.running.ports[p];
      return !!cfg && !sw.rebooting && !cfg.shutdown && !sw.errDisabled.includes(p);
    }
    const h = this.state.hosts[d];
    if (h) return h.powered && (p !== h.nic || h.nicEnabled);
    return !!this.state.routers[d];
  }

  link(ref: PortRef): LinkInfo {
    const t = this.trace(ref);
    if (!t.end) return { up: false, peer: null, cables: t.cables, reason: t.broken ?? 'nocable' };
    if (t.cables.some((c) => c.fault !== 'none')) return { up: false, peer: t.end, cables: t.cables, reason: 'fault' };
    if (!this.adminUp(ref)) return { up: false, peer: t.end, cables: t.cables, reason: 'admin-down' };
    if (!this.adminUp(t.end)) return { up: false, peer: t.end, cables: t.cables, reason: 'peer-down' };
    return { up: true, peer: t.end, cables: t.cables, reason: 'ok' };
  }

  // ================================================================ couche 2

  /** Ce que transporte un port : étiquette (n° de VLAN ou « u » pour non étiqueté) → nœud. */
  private emitMap(ref: PortRef): Map<string, string> {
    const m = new Map<string, string>();
    const [d, p] = splitRef(ref);
    const sw = this.state.switches[d];
    if (sw) {
      const cfg = sw.running.ports[p];
      const vlans = sw.running.vlans;
      if (!cfg) return m;
      if (cfg.mode === 'access') {
        if (vlans[cfg.accessVlan] !== undefined) m.set('u', `sw:${d}:${cfg.accessVlan}`);
      } else {
        for (const key of Object.keys(vlans)) {
          const v = Number(key);
          if (cfg.allowedVlans && !cfg.allowedVlans.includes(v)) continue;
          if (v === cfg.nativeVlan) m.set('u', `sw:${d}:${v}`);
          else m.set(String(v), `sw:${d}:${v}`);
        }
      }
      return m;
    }
    const rt = this.state.routers[d];
    if (rt) {
      for (const s of rt.subifs) if (s.parent === p) m.set(String(s.vlan), `rt:${d}:${s.vlan}`);
      return m;
    }
    if (this.state.hosts[d]) m.set('u', `host:${d}`);
    return m;
  }

  /** Tous les ports actifs (non passifs) existants. */
  private activePorts(): PortRef[] {
    const refs: PortRef[] = [];
    for (const [id, sw] of Object.entries(this.state.switches)) for (const p of Object.keys(sw.running.ports)) refs.push(`${id}:${p}`);
    for (const id of Object.keys(this.state.routers)) for (let i = 0; i < 4; i++) refs.push(`${id}:Gi0/${i}`);
    for (const h of Object.values(this.state.hosts)) refs.push(`${h.id}:${h.nic}`);
    return refs;
  }

  private graph(): { parent: Map<string, string>; compIds: Map<string, number> } {
    if (this.cache && this.cache.version === this.state.version) return this.cache;
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r)!;
      parent.set(x, r);
      return r;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    const seen = new Set<string>();
    for (const ref of this.activePorts()) {
      if (seen.has(ref)) continue;
      const l = this.link(ref);
      if (!l.up || !l.peer) continue;
      seen.add(ref);
      seen.add(l.peer);
      const ma = this.emitMap(ref);
      const mb = this.emitMap(l.peer);
      ma.forEach((node, tag) => {
        const other = mb.get(tag);
        if (other) union(node, other);
      });
    }
    // Interfaces de management des switchs (SVI)
    for (const [id, sw] of Object.entries(this.state.switches)) {
      const mg = sw.running.mgmt;
      if (mg && sw.running.vlans[mg.vlan] !== undefined && !sw.rebooting) union(`svi:${id}`, `sw:${id}:${mg.vlan}`);
    }
    const compIds = new Map<string, number>();
    let n = 0;
    const roots = new Map<string, number>();
    for (const k of parent.keys()) {
      const r = find(k);
      if (!roots.has(r)) roots.set(r, n++);
      compIds.set(k, roots.get(r)!);
    }
    this.cache = { version: this.state.version, parent, compIds };
    return this.cache;
  }

  /** Numéro de domaine de diffusion d'un nœud (null s'il est isolé). */
  compOf(node: string): number | null {
    return this.graph().compIds.get(node) ?? null;
  }

  /** VLAN dans laquelle se trouve un hôte (selon le port du switch en face). */
  hostVlan(hostId: string): number | null {
    const h = this.state.hosts[hostId];
    if (!h) return null;
    const l = this.link(`${h.id}:${h.nic}`);
    if (!l.up || !l.peer) return null;
    const [d, p] = splitRef(l.peer);
    const sw = this.state.switches[d];
    if (!sw) return null;
    const cfg = sw.running.ports[p];
    const v = cfg.mode === 'access' ? cfg.accessVlan : cfg.nativeVlan;
    return sw.running.vlans[v] !== undefined ? v : null;
  }

  // ================================================================ couche 3

  private scopeFor(vlan: number | null): DhcpScope | undefined {
    return this.state.dhcp.scopes.find((s) => s.vlan === vlan);
  }

  /** Le serveur DHCP est-il joignable depuis le segment de cet hôte ? Renvoie l'étendue utilisée. */
  private dhcpScopeFor(hostId: string): DhcpScope | null {
    const comp = this.compOf(`host:${hostId}`);
    if (comp === null) return null;
    const srvId = this.state.dhcp.server;
    const srv = this.state.hosts[srvId];
    if (!srv || !srv.powered) return null;
    const srvComp = this.compOf(`host:${srvId}`);
    if (srvComp === null) return null;
    if (srvComp === comp) return this.scopeFor(this.hostVlan(hostId)) ?? null;
    // Relais DHCP : une sous-interface du routeur dans le segment de l'hôte, avec ip helper vers le serveur,
    // et le routeur doit lui-même joindre le serveur.
    for (const [rid, rt] of Object.entries(this.state.routers)) {
      const reachesServer = rt.subifs.some((s) => this.compOf(`rt:${rid}:${s.vlan}`) === srvComp);
      if (!reachesServer) continue;
      for (const s of rt.subifs) {
        if (s.helper === srv.ip.ip && this.compOf(`rt:${rid}:${s.vlan}`) === comp) {
          const scope = this.scopeFor(s.vlan);
          if (scope) return scope;
        }
      }
    }
    return null;
  }

  private leaseFor(mac: string, scope: DhcpScope): string {
    const leases = this.state.dhcp.leases;
    const current = leases[mac];
    if (current && sameSubnet(current, scope.network, scope.mask)) return current;
    const used = new Set(Object.values(leases));
    const base = ipToInt(scope.network)!;
    for (let i = scope.start; i <= scope.end; i++) {
      const ip = intToIp(base + i);
      if (!used.has(ip)) {
        leases[mac] = ip;
        return ip;
      }
    }
    return intToIp(base + scope.end);
  }

  /** Configuration IP effective d'un hôte (ce qu'afficherait « ipconfig »). */
  hostIp(hostId: string): HostIpInfo {
    const none: HostIpInfo = { status: 'off', ip: null, mask: null, gateway: null, dns: null, vlan: null };
    const h = this.state.hosts[hostId];
    if (!h || !h.powered) return none;
    if (!h.nicEnabled) return { ...none, status: 'disabled' };
    const l = this.link(`${h.id}:${h.nic}`);
    if (!l.up) return { ...none, status: 'disconnected' };
    const vlan = this.hostVlan(hostId);
    if (h.ip.mode === 'static') {
      return { status: 'static', ip: h.ip.ip, mask: h.ip.mask, gateway: h.ip.gateway || null, dns: h.ip.dns || null, vlan };
    }
    const scope = this.dhcpScopeFor(hostId);
    if (scope) {
      return { status: 'dhcp', ip: this.leaseFor(h.mac, scope), mask: scope.mask, gateway: scope.gateway, dns: scope.dns, vlan };
    }
    return { status: 'apipa', ip: apipaFor(h.mac), mask: '255.255.0.0', gateway: null, dns: null, vlan };
  }

  /** Tous les points d'extrémité IP joignables (hôtes, SVI des switchs, sous-interfaces du routeur). */
  private endpoints(): Endpoint[] {
    const eps: Endpoint[] = [];
    for (const h of Object.values(this.state.hosts)) {
      const info = this.hostIp(h.id);
      const comp = this.compOf(`host:${h.id}`);
      if (info.ip && info.mask && comp !== null) {
        eps.push({ id: h.id, ip: info.ip, mask: info.mask, gateway: info.gateway, comp, apipa: info.status === 'apipa' });
      }
    }
    for (const [id, sw] of Object.entries(this.state.switches)) {
      const mg = sw.running.mgmt;
      const comp = this.compOf(`svi:${id}`);
      if (mg && comp !== null) eps.push({ id, ip: mg.ip, mask: mg.mask, gateway: mg.gateway || null, comp, apipa: false });
    }
    return eps;
  }

  private routerIfaces(): { router: string; ip: string; mask: string; comp: number | null }[] {
    const list: { router: string; ip: string; mask: string; comp: number | null }[] = [];
    for (const [rid, rt] of Object.entries(this.state.routers)) {
      for (const s of rt.subifs) list.push({ router: rid, ip: s.ip, mask: s.mask, comp: this.compOf(`rt:${rid}:${s.vlan}`) });
    }
    return list;
  }

  /** Ping depuis un hôte ou un switch (son SVI) vers une adresse IP. */
  ping(sourceId: string, targetIp: string): PingResult {
    const src = this.endpoints().find((e) => e.id === sourceId);
    if (!src) return { result: 'general' };
    if (ipToInt(targetIp) === null) return { result: 'general' };
    if (targetIp === src.ip || targetIp === '127.0.0.1') return { result: 'ok', ttl: 128 };
    const all = this.endpoints();
    const target = all.find((e) => e.ip === targetIp && e.id !== src.id);
    const rIfaces = this.routerIfaces();

    // Même sous-réseau : il faut être dans le même domaine de diffusion (ARP).
    if (sameSubnet(src.ip, targetIp, src.mask)) {
      if (target && target.comp === src.comp && sameSubnet(target.ip, src.ip, target.mask)) return { result: 'ok', ttl: 128 };
      const rif = rIfaces.find((r) => r.ip === targetIp && r.comp === src.comp);
      if (rif) return { result: 'ok', ttl: 255 };
      return { result: 'unreachable', from: src.ip };
    }
    if (src.apipa) return { result: 'general' };
    // Sinon, passage par la passerelle.
    const gw = rIfaces.find((r) => r.ip === src.gateway && r.comp === src.comp);
    if (!src.gateway || !gw) return { result: 'unreachable', from: src.ip };
    // Interface du routeur elle-même ?
    if (rIfaces.some((r) => r.router === gw.router && r.ip === targetIp)) return { result: 'ok', ttl: 255 };
    // Le routeur doit avoir une interface dans le sous-réseau de destination, dans le domaine de la cible.
    const out = rIfaces.find((r) => r.router === gw.router && sameSubnet(r.ip, targetIp, r.mask));
    if (!out) return { result: 'unreachable', from: gw.ip };
    if (!target || target.comp !== out.comp) return { result: 'timeout' };
    // La réponse doit pouvoir revenir : passerelle correcte côté cible.
    if (target.gateway !== out.ip) return { result: 'timeout' };
    return { result: 'ok', ttl: 127 };
  }

  // ================================================================ switchs

  portStatus(switchId: string, port: string): SwitchPortStatus {
    const sw = this.state.switches[switchId];
    if (!sw) return 'notconnect';
    const cfg = sw.running.ports[port];
    if (sw.rebooting) return 'notconnect';
    if (sw.errDisabled.includes(port)) return 'err-disabled';
    if (!cfg || cfg.shutdown) return 'disabled';
    if (!this.link(`${switchId}:${port}`).up) return 'notconnect';
    if (cfg.mode === 'access' && sw.running.vlans[cfg.accessVlan] === undefined) return 'inactive';
    return 'connected';
  }

  /** Équipement à l'autre bout d'un port (nom lisible), ou null. */
  peerName(ref: PortRef): string | null {
    const t = this.trace(ref);
    return t.end ? splitRef(t.end)[0] : null;
  }

  /** Table d'adresses MAC apprises par un switch. */
  macTable(switchId: string): { vlan: number; mac: string; port: string }[] {
    const sw = this.state.switches[switchId];
    if (!sw || sw.rebooting) return [];
    const entries: { vlan: number; mac: string; port: string }[] = [];
    const add = (vlan: number, mac: string, port: string) => {
      if (!entries.some((e) => e.vlan === vlan && e.mac === mac)) entries.push({ vlan, mac, port });
    };
    for (const port of Object.keys(sw.running.ports)) {
      const l = this.link(`${switchId}:${port}`);
      if (!l.up || !l.peer) continue;
      const [pd, pp] = splitRef(l.peer);
      const cfg = sw.running.ports[port];
      const host = this.state.hosts[pd];
      if (host) {
        const v = cfg.mode === 'access' ? cfg.accessVlan : cfg.nativeVlan;
        if (sw.running.vlans[v] !== undefined) add(v, host.mac, port);
        continue;
      }
      // Tout ce qui est « derrière » ce port et dans le même domaine qu'une VLAN du switch.
      const behind = this.hostsBehind(switchId, pd, pp);
      for (const id of behind) {
        const h = this.state.hosts[id];
        const v = this.hostVlan(id);
        if (v !== null && this.compOf(`host:${id}`) === this.compOf(`sw:${switchId}:${v}`)) add(v, h.mac, port);
      }
      const rt = this.state.routers[pd];
      if (rt) {
        for (const s of rt.subifs) {
          if (s.parent === pp && this.compOf(`rt:${pd}:${s.vlan}`) === this.compOf(`sw:${switchId}:${s.vlan}`)) add(s.vlan, macFor(pd), port);
        }
      }
    }
    return entries.sort((a, b) => a.vlan - b.vlan || a.port.localeCompare(b.port, undefined, { numeric: true }));
  }

  /** Hôtes accessibles physiquement au-delà d'un équipement, sans repasser par `exclude`. */
  private hostsBehind(exclude: string, device: string, _entryPort: string): string[] {
    const result = new Set<string>();
    const visited = new Set<string>([exclude]);
    const stack = [device];
    while (stack.length) {
      const d = stack.pop()!;
      if (visited.has(d)) continue;
      visited.add(d);
      if (this.state.hosts[d]) {
        result.add(d);
        continue;
      }
      const sw = this.state.switches[d];
      const ports = sw ? Object.keys(sw.running.ports) : this.state.routers[d] ? ['Gi0/0', 'Gi0/1', 'Gi0/2', 'Gi0/3'] : [];
      for (const p of ports) {
        const l = this.link(`${d}:${p}`);
        if (l.up && l.peer) stack.push(splitRef(l.peer)[0]);
      }
    }
    return [...result];
  }

  /** « copy running-config startup-config » */
  writeMemory(switchId: string): void {
    const sw = this.state.switches[switchId];
    if (!sw) return;
    sw.startup = clone(sw.running);
    this.changed();
  }

  /** Redémarrage : la configuration non sauvegardée est PERDUE. */
  startReboot(switchId: string): void {
    const sw = this.state.switches[switchId];
    if (!sw) return;
    sw.rebooting = true;
    sw.running = clone(sw.startup);
    sw.errDisabled = [];
    this.changed();
  }

  finishReboot(switchId: string): void {
    const sw = this.state.switches[switchId];
    if (!sw) return;
    sw.rebooting = false;
    this.changed();
  }

  /** La config courante diffère-t-elle de la config de démarrage ? */
  hasUnsavedChanges(switchId: string): boolean {
    const sw = this.state.switches[switchId];
    return !!sw && JSON.stringify(sw.running) !== JSON.stringify(sw.startup);
  }

  host(id: string): HostState | undefined {
    return this.state.hosts[id];
  }

  switchConfig(id: string): SwitchConfig | undefined {
    return this.state.switches[id]?.running;
  }
}
