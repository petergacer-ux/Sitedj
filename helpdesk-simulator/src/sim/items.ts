/** Catalogue du matériel du helpdesk. */
import type { ItemId } from './types';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  /** Stock de base (réassort). */
  base: number;
  /** Outil (non consommé). */
  tool?: boolean;
  color: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  rj45: { id: 'rj45', name: 'Câble RJ45 3 m', icon: '🔌', base: 6, color: 0x2d6cdf },
  patch: { id: 'patch', name: 'Cordon de brassage', icon: '〰️', base: 10, color: 0xf2c230 },
  tester: { id: 'tester', name: 'Testeur de câble', icon: '📟', base: 1, tool: true, color: 0xf39c12 },
  usb: { id: 'usb', name: 'Clé USB d’installation', icon: '💾', base: 2, tool: true, color: 0xc0392b },
  mouse: { id: 'mouse', name: 'Souris', icon: '🖱️', base: 4, color: 0x2b2b2b },
  keyboard: { id: 'keyboard', name: 'Clavier', icon: '⌨️', base: 3, color: 0x2b2b2b },
  monitor: { id: 'monitor', name: 'Écran 24"', icon: '🖥️', base: 2, color: 0x1d1f22 },
  psu: { id: 'psu', name: 'Alimentation PC', icon: '🔋', base: 2, color: 0x555555 },
  dock: { id: 'dock', name: 'Station d’accueil', icon: '🧩', base: 2, color: 0x333333 },
  toner: { id: 'toner', name: 'Toner noir', icon: '🖨️', base: 3, color: 0x111111 },
  cartridge: { id: 'cartridge', name: 'Cartouche couleur', icon: '🎨', base: 3, color: 0x2e86c1 },
  screwdriver: { id: 'screwdriver', name: 'Tournevis', icon: '🪛', base: 1, tool: true, color: 0xd35400 },
  ram: { id: 'ram', name: 'Barrette RAM 8 Go', icon: '🧠', base: 4, color: 0x27ae60 },
  laptop: { id: 'laptop', name: 'Portable de prêt', icon: '💻', base: 2, color: 0x7f8c8d },
  videocable: { id: 'videocable', name: 'Câble HDMI', icon: '📺', base: 3, color: 0x222222 },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
