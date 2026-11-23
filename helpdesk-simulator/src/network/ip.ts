/** Petits utilitaires IPv4 (sans dépendance). */

export function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

export function isValidIp(ip: string): boolean {
  return ipToInt(ip) !== null;
}

/** Même sous-réseau ? */
export function sameSubnet(a: string, b: string, mask: string): boolean {
  const ia = ipToInt(a);
  const ib = ipToInt(b);
  const im = ipToInt(mask);
  if (ia === null || ib === null || im === null) return false;
  return ((ia & im) >>> 0) === ((ib & im) >>> 0);
}

/** Petit hachage stable d'une chaîne (pour les adresses APIPA, MAC…). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Adresse APIPA stable (169.254.x.y) dérivée de l'adresse MAC. */
export function apipaFor(mac: string): string {
  const h = hash(mac);
  return `169.254.${(h % 254) + 1}.${((h >>> 8) % 254) + 1}`;
}

/** Adresse MAC stable dérivée d'un nom d'équipement. */
export function macFor(name: string): string {
  const h = hash(name);
  const h2 = hash(name + '#');
  const bytes = [0x00, 0x1a, 0x2b, (h >>> 16) & 255, (h >>> 8) & 255, h2 & 255];
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
}

/** Format Cisco d'une MAC : 001a.2b3c.4d5e */
export function ciscoMac(mac: string): string {
  const hex = mac.replace(/[^0-9a-f]/gi, '').toLowerCase();
  return `${hex.slice(0, 4)}.${hex.slice(4, 8)}.${hex.slice(8, 12)}`;
}
