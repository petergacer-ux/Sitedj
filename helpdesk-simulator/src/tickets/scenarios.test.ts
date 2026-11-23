/**
 * Tests de TOUS les scénarios : pour chacun, on injecte la panne, on vérifie que le ticket
 * ne peut pas être résolu tant que rien n'est fait, puis on applique la solution du technicien
 * et on vérifie que le jeu la reconnaît.
 */
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import { createInitialNetwork } from '../network/initial';
import { Network } from '../network/Network';
import { Office, createInitialOffice } from '../sim/Office';
import { TicketSystem } from './TicketSystem';

function setup(seed = 1) {
  const net = new Network(createInitialNetwork());
  const office = new Office(net, createInitialOffice());
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return { net, office, ts: new TicketSystem(office, net, rng) };
}

describe('catalogue de scénarios', () => {
  it('au moins 20 scénarios, identifiants uniques', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });
  it('tous les niveaux sont représentés', () => {
    for (const lvl of [0, 1, 2, 3]) expect(SCENARIOS.some((s) => s.minLevel === lvl)).toBe(true);
  });
  it('au départ, le monde est sain : aucun scénario n’est déjà « résolu à tort » après injection', () => {
    for (const sc of SCENARIOS) {
      const { ts } = setup();
      expect(ts.targetsFor(sc).length, sc.id).toBeGreaterThan(0);
    }
  });
});

describe.each(SCENARIOS.map((s) => [s.id, s] as const))('scénario %s', (_id, sc) => {
  it('panne injectée → non résolu → solution → résolu', () => {
    const { ts } = setup();
    const target = ts.targetsFor(sc)[0];
    const [ticket] = ts.create(sc, target, 1440 + 540);
    expect(ticket.status).toBe('new');
    expect(ticket.title.length).toBeGreaterThan(3);
    expect(ticket.description).not.toContain('{prenom}');
    if (sc.id !== 'pret-portable' && sc.id !== 'boite-partagee' && sc.id !== 'nouvel-arrivant') {
      // (ces trois-là sont des demandes : rien n'est « cassé », mais rien n'est fait non plus)
    }
    expect(ts.isResolved(ticket), 'ne doit pas être résolu sans intervention').toBe(false);
    const fail = ts.resolve(ticket.id, 'Je pense que c’est bon', 1440 + 560);
    expect(fail.ok).toBe(false);
    expect(ticket.reopenCount).toBe(1);
    sc.solve(ts.ctx, { user: ticket.requester, host: ticket.host, desk: ticket.desk, data: ticket.data });
    const ok = ts.resolve(ticket.id, 'Corrigé', 1440 + 570);
    expect(ok.ok).toBe(true);
    expect(ticket.status).toBe('solved');
    expect(ok.xp).toBeGreaterThan(0);
  });
});

describe('cycle de vie des tickets', () => {
  it('SLA, satisfaction et clôture automatique', () => {
    const { ts } = setup();
    const sc = SCENARIOS.find((s) => s.id === 'cable-debranche')!;
    const [t] = ts.create(sc, ts.targetsFor(sc)[0], 1000);
    ts.take(t.id, 1001);
    expect(t.status).toBe('assigned');
    ts.addFollowup(t.id, 'tech', 'Je passe à votre bureau dans 5 minutes.', 'tech', 1002);
    expect(t.contacted).toBe(true);
    sc.solve(ts.ctx, { user: t.requester, host: t.host, desk: t.desk, data: t.data });
    const r = ts.resolve(t.id, 'Câble rebranché', 1030);
    expect(r.ok).toBe(true);
    expect(t.slaMissed).toBe(false);
    expect(r.satisfaction!).toBeGreaterThanOrEqual(80);
    ts.tick(1100);
    expect(t.status).toBe('closed');
  });

  it('SLA dépassé : moins d’XP et de satisfaction', () => {
    const { ts } = setup();
    const sc = SCENARIOS.find((s) => s.id === 'cable-debranche')!;
    const [t] = ts.create(sc, ts.targetsFor(sc)[0], 1000);
    ts.tick(1000 + 500);
    expect(t.slaMissed).toBe(true);
    sc.solve(ts.ctx, { user: t.requester, host: t.host, desk: t.desk, data: t.data });
    const r = ts.resolve(t.id, 'ok', 1600);
    expect(r.xp).toBeLessThan(sc.xp);
    expect(r.satisfaction!).toBeLessThan(70);
  });

  it('une panne générale crée plusieurs tickets', () => {
    const { ts } = setup();
    const sc = SCENARIOS.find((s) => s.id === 'config-perdue')!;
    const created = ts.create(sc, ts.targetsFor(sc)[0], 1000);
    expect(created).toHaveLength(2);
  });

  it('pas deux tickets en même temps pour le même utilisateur', () => {
    const { ts } = setup();
    for (let i = 0; i < 10; i++) {
      const p = ts.pickScenario(3);
      if (p) ts.create(p.sc, p.target, 1000 + i);
    }
    const users = ts.open.map((t) => t.requester);
    expect(new Set(users).size).toBe(users.length);
  });

  it('l’escalade ferme le ticket et répare en coulisses', () => {
    const { ts, net } = setup();
    const sc = SCENARIOS.find((s) => s.id === 'port-shutdown')!;
    const [t] = ts.create(sc, ts.targetsFor(sc)[0], 1000);
    ts.escalate(t.id, 'Pas d’accès au switch', 1010);
    expect(t.status).toBe('closed');
    expect(net.hostIp(t.host).status).toBe('dhcp');
  });
});
