/**
 * Disposition physique de la baie réseau (données pures, sans Three.js).
 * Repère local de la baie : x vers la droite, y vers le haut (depuis le sol), z vers l'avant.
 * Les coordonnées des ports sont relatives au CENTRE de la façade de l'équipement.
 */

/** Hauteur d'une unité de baie (exagérée pour la lisibilité). */
export const RACK_U = 0.06;
export const RACK_W = 0.6;
export const RACK_D = 0.9;
export const RACK_H = 2.0;
/** Plan de la façade des équipements (z local). */
export const RACK_FRONT_Z = RACK_D / 2 - 0.03;
const TOP = 1.86;

export type RackDeviceKind = 'patch' | 'switch' | 'router' | 'server' | 'nas' | 'brush' | 'blank';

export interface RackPortDef {
  name: string;
  x: number;
  y: number;
}

export interface RackDeviceDef {
  id: string;
  kind: RackDeviceKind;
  label: string;
  /** Position (en U) depuis le haut de la zone utile. */
  slot: number;
  heightU: number;
  depth: number;
  ports: RackPortDef[];
}

/** Patch panel 24 ports sur une rangée. */
function patchPorts(): RackPortDef[] {
  const ports: RackPortDef[] = [];
  for (let i = 0; i < 24; i++) ports.push({ name: String(i + 1), x: -0.17 + i * 0.0168 + Math.floor(i / 6) * 0.004, y: -0.006 });
  return ports;
}

/** Switch 24 ports Fa0/1-24 (impairs en haut, pairs en bas, comme chez Cisco) + 2 uplinks Gi0/1-2. */
function switchPorts(): RackPortDef[] {
  const ports: RackPortDef[] = [];
  for (let i = 0; i < 24; i++) {
    const col = Math.floor(i / 2);
    const row = i % 2;
    ports.push({ name: `Fa0/${i + 1}`, x: -0.115 + col * 0.0215 + Math.floor(col / 6) * 0.008, y: row === 0 ? 0.0125 : -0.0135 });
  }
  ports.push({ name: 'Gi0/1', x: 0.2, y: 0.0125 });
  ports.push({ name: 'Gi0/2', x: 0.2, y: -0.0135 });
  return ports;
}

export const RACK_DEVICES: RackDeviceDef[] = [
  { id: 'PP-01', kind: 'patch', label: 'PP-01', slot: 0, heightU: 1, depth: 0.12, ports: patchPorts() },
  { id: 'BRUSH-1', kind: 'brush', label: '', slot: 1, heightU: 1, depth: 0.06, ports: [] },
  { id: 'SW-01', kind: 'switch', label: 'SW-01', slot: 2, heightU: 1, depth: 0.3, ports: switchPorts() },
  { id: 'SW-02', kind: 'switch', label: 'SW-02', slot: 3, heightU: 1, depth: 0.3, ports: switchPorts() },
  { id: 'BLANK-1', kind: 'blank', label: '', slot: 4, heightU: 1, depth: 0.01, ports: [] },
  {
    id: 'RT-FW-01',
    kind: 'router',
    label: 'RT-FW-01',
    slot: 5,
    heightU: 1,
    depth: 0.35,
    ports: [0, 1, 2, 3].map((i) => ({ name: `Gi0/${i}`, x: 0.08 + i * 0.03, y: -0.004 })),
  },
  { id: 'BLANK-2', kind: 'blank', label: '', slot: 6, heightU: 1, depth: 0.01, ports: [] },
  {
    id: 'SRV-01',
    kind: 'server',
    label: 'SRV-01 (AD/DNS/DHCP/Fichiers)',
    slot: 7,
    heightU: 2,
    depth: 0.7,
    ports: [
      { name: 'eth0', x: 0.205, y: 0.012 },
      { name: 'eth1', x: 0.205, y: -0.014 },
    ],
  },
  { id: 'BLANK-3', kind: 'blank', label: '', slot: 9, heightU: 1, depth: 0.01, ports: [] },
  { id: 'NAS-01', kind: 'nas', label: 'NAS-01 (Sauvegardes)', slot: 10, heightU: 2, depth: 0.5, ports: [] },
];

export function rackDevice(id: string): RackDeviceDef | undefined {
  return RACK_DEVICES.find((d) => d.id === id);
}

/** Centre vertical (y local) de la façade d'un équipement. */
export function deviceCenterY(d: RackDeviceDef): number {
  return TOP - d.slot * RACK_U - (d.heightU * RACK_U) / 2;
}

/** Position locale (dans la baie) d'un port, ou null s'il n'est pas dans la baie. */
export function rackPortPosition(deviceId: string, port: string): { x: number; y: number; z: number } | null {
  const d = rackDevice(deviceId);
  const p = d?.ports.find((pp) => pp.name === port);
  if (!d || !p) return null;
  return { x: p.x, y: deviceCenterY(d) + p.y, z: RACK_FRONT_Z };
}

/** Longueurs de cordons de brassage disponibles (m). */
export const PATCH_LENGTHS = [0.5, 1, 2, 3];

/**
 * Un cordon est-il assez long pour relier deux ports ?
 * Il faut la distance en ligne droite + une marge pour sortir des ports et passer dans le guide-câbles.
 */
export function patchLengthOk(a: { x: number; y: number }, b: { x: number; y: number }, length: number): boolean {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return d + 0.12 <= length;
}

export const PATCH_COLORS: { id: string; name: string; hex: number }[] = [
  { id: 'bleu', name: 'Bleu', hex: 0x2d6cdf },
  { id: 'jaune', name: 'Jaune', hex: 0xf2c230 },
  { id: 'vert', name: 'Vert', hex: 0x2fb05a },
  { id: 'rouge', name: 'Rouge', hex: 0xd83a3a },
  { id: 'gris', name: 'Gris', hex: 0x9aa0a6 },
  { id: 'noir', name: 'Noir', hex: 0x222222 },
];
