/** Fonctions utilitaires partagées par les scénarios. */
import { DESKS } from '../map';
import { vlanForRoom } from '../../network/initial';
import { splitRef } from '../../network/Network';
import type { ScenarioCtx, ScenarioTarget } from '../../tickets/types';
import type { UserDef } from '../users';

export function deskOf(user: UserDef | string) {
  const id = typeof user === 'string' ? user : user.id;
  return DESKS.find((d) => d.userId === id);
}

/** VLAN attendue pour le poste d'un bureau. */
export function expectedVlan(deskId: string): number {
  const d = DESKS.find((x) => x.id === deskId);
  return d ? vlanForRoom(d.room) : 10;
}

/** Port du switch sur lequel la prise d'un bureau est brassée (via le panneau). */
export function switchPortOfDesk(ctx: ScenarioCtx, deskId: string): string | null {
  const pp = ctx.net.state.horizontal[`${deskId}:jack`];
  if (!pp) return null;
  const c = ctx.net.cableAt(pp);
  if (!c) return null;
  const other = c.a === pp ? c.b : c.a;
  return other && ctx.net.state.switches[splitRef(other)[0]] ? other : null;
}

/** Le poste a une IP DHCP dans la bonne VLAN. */
export function hostOk(ctx: ScenarioCtx, t: ScenarioTarget): boolean {
  const ip = ctx.net.hostIp(t.host);
  return ip.status === 'dhcp' && ip.vlan === expectedVlan(t.desk) && !ctx.office.pc(t.host)?.released;
}

export function pick<T>(ctx: ScenarioCtx, list: T[]): T {
  return list[Math.floor(ctx.rng() * list.length) % list.length];
}

export const isCompta = (_c: ScenarioCtx, u: UserDef) => u.service === 'Compta';
export const isCommercial = (_c: ScenarioCtx, u: UserDef) => u.service === 'Commercial';
