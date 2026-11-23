/** Sauvegarde / chargement dans localStorage. */
import type { NetworkState } from '../network/types';
import type { GameState } from './GameState';

const KEY = 'helpdesk-sim.save';
const VERSION = 2;

export interface PlayerPose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface SaveData {
  version: number;
  savedAt: string;
  day: number;
  minutes: number;
  energy: number;
  xp: number;
  satisfaction: number;
  player: PlayerPose;
  openDoors: string[];
  /** État du réseau (câbles, switchs, baux DHCP). Absent dans les sauvegardes v1. */
  network?: NetworkState;
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function writeSave(state: GameState, player: PlayerPose, openDoors: string[], network: NetworkState): boolean {
  const data: SaveData = {
    version: VERSION,
    savedAt: new Date().toISOString(),
    day: state.clock.day,
    minutes: state.clock.minutes,
    energy: state.energy,
    xp: state.xp,
    satisfaction: state.satisfaction,
    player,
    openDoors,
    network,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    // Les sauvegardes v1 (étape 1) restent lisibles : le réseau repart de zéro.
    return data.version === VERSION || data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export function applySave(state: GameState, data: SaveData): void {
  state.clock.restore(data.day, data.minutes);
  state.energy = data.energy;
  state.xp = data.xp;
  state.satisfaction = data.satisfaction;
  state.events.emit('statsChanged', undefined);
}
