import { beforeEach, describe, expect, it } from 'vitest';
import { patchLengthOk, rackPortPosition } from '../data/rack';
import { createInitialNetwork } from './initial';
import { Network } from './Network';

let net: Network;
beforeEach(() => {
  net = new Network(createInitialNetwork());
});

const cableOf = (ref: string) => net.cableAt(ref)!;

describe('couche physique', () => {
  it('suit le chemin PC → prise → panneau → switch', () => {
    const t = net.trace('PC-COMPTA-01:eth0');
    expect(t.end).toBe('SW-01:Fa0/1');
    expect(t.cables).toHaveLength(2); // câble du poste + cordon de brassage
    expect(net.link('PC-COMPTA-01:eth0').up).toBe(true);
    expect(net.portStatus('SW-01', 'Fa0/1')).toBe('connected');
  });

  it('le chemin est symétrique (depuis le switch)', () => {
    expect(net.trace('SW-01:Fa0/1').end).toBe('PC-COMPTA-01:eth0');
  });

  it('débrancher le câble du PC coupe le lien', () => {
    net.unplug(cableOf('PC-COMPTA-01:eth0').id);
    expect(net.link('PC-COMPTA-01:eth0').reason).toBe('loose');
    expect(net.portStatus('SW-01', 'Fa0/1')).toBe('notconnect');
    expect(net.hostIp('PC-COMPTA-01').status).toBe('disconnected');
    net.plug(cableOf('PC-COMPTA-01:eth0').id, 'B-01:jack');
    expect(net.hostIp('PC-COMPTA-01').status).toBe('dhcp');
  });

  it('une prise non brassée dans la baie ne donne pas de lien', () => {
    net.state.hosts['PC-COM-05'].powered = true;
    const l = net.link('PC-COM-05:eth0');
    expect(l.up).toBe(false);
    expect(l.reason).toBe('nocable');
    expect(net.trace('PC-COM-05:eth0').stoppedAt).toBe('PP-01:12');
  });

  it('brasser la prise B-12 sur un port libre en VLAN 10 donne une IP', () => {
    net.state.hosts['PC-COM-05'].powered = true;
    const r = net.connect('PP-01:12', 'SW-01:Fa0/12', { color: 'bleu', length: 0.5 });
    expect(r.ok).toBe(true);
    const ip = net.hostIp('PC-COM-05');
    expect(ip.status).toBe('dhcp');
    expect(ip.ip).toMatch(/^192\.168\.10\./);
    expect(ip.gateway).toBe('192.168.10.254');
  });

  it('refuse de brancher deux cordons sur le même port', () => {
    const r = net.connect('PP-01:12', 'SW-01:Fa0/1');
    expect(r.ok).toBe(false);
  });

  it('un câble défectueux coupe le lien', () => {
    cableOf('PC-COMPTA-02:eth0').fault = 'open';
    net.changed();
    expect(net.link('PC-COMPTA-02:eth0').reason).toBe('fault');
    expect(net.portStatus('SW-01', 'Fa0/2')).toBe('notconnect');
  });

  it('carte réseau désactivée', () => {
    net.state.hosts['PC-COMPTA-01'].nicEnabled = false;
    net.changed();
    expect(net.hostIp('PC-COMPTA-01').status).toBe('disabled');
    expect(net.portStatus('SW-01', 'Fa0/1')).toBe('notconnect');
  });
});

describe('VLAN et DHCP', () => {
  it('chaque service reçoit une IP dans sa VLAN', () => {
    expect(net.hostIp('PC-COMPTA-01').ip).toMatch(/^192\.168\.20\./);
    expect(net.hostIp('PC-COM-01').ip).toMatch(/^192\.168\.10\./);
    expect(net.hostIp('PC-HELPDESK-01').ip).toMatch(/^192\.168\.99\./);
    expect(net.hostIp('PC-COMPTA-01').vlan).toBe(20);
  });

  it('les baux DHCP sont stables et uniques', () => {
    const a = net.hostIp('PC-COMPTA-01').ip;
    const b = net.hostIp('PC-COMPTA-02').ip;
    expect(a).not.toBe(b);
    net.changed();
    expect(net.hostIp('PC-COMPTA-01').ip).toBe(a);
  });

  it('port en shutdown → APIPA impossible (pas de lien) puis IP au no shutdown', () => {
    net.state.switches['SW-01'].running.ports['Fa0/3'].shutdown = true;
    net.changed();
    expect(net.portStatus('SW-01', 'Fa0/3')).toBe('disabled');
    expect(net.hostIp('PC-COMPTA-03').status).toBe('disconnected');
    net.state.switches['SW-01'].running.ports['Fa0/3'].shutdown = false;
    net.changed();
    expect(net.hostIp('PC-COMPTA-03').status).toBe('dhcp');
  });

  it('port dans une VLAN sans DHCP → adresse APIPA 169.254', () => {
    net.state.switches['SW-01'].running.ports['Fa0/1'].accessVlan = 1;
    net.changed();
    const ip = net.hostIp('PC-COMPTA-01');
    expect(ip.status).toBe('apipa');
    expect(ip.ip).toMatch(/^169\.254\./);
  });

  it('VLAN inexistante sur le switch → port inactif', () => {
    net.state.switches['SW-01'].running.ports['Fa0/1'].accessVlan = 50;
    net.changed();
    expect(net.portStatus('SW-01', 'Fa0/1')).toBe('inactive');
    expect(net.hostIp('PC-COMPTA-01').status).toBe('apipa');
  });

  it('un mauvais VLAN donne une IP du mauvais réseau', () => {
    net.state.switches['SW-01'].running.ports['Fa0/1'].accessVlan = 10;
    net.changed();
    expect(net.hostIp('PC-COMPTA-01').ip).toMatch(/^192\.168\.10\./);
  });

  it('trunk coupé entre les switchs → plus de DHCP pour SW-01', () => {
    net.disconnect(cableOf('SW-01:Gi0/2').id);
    expect(net.hostIp('PC-COMPTA-01').status).toBe('apipa');
    // SW-02 reste fonctionnel
    expect(net.hostIp('PC-HELPDESK-01').status).toBe('dhcp');
  });

  it('VLAN retirée des VLAN autorisées sur le trunk', () => {
    net.state.switches['SW-01'].running.ports['Gi0/1'].allowedVlans = [10, 30, 99];
    net.changed();
    expect(net.hostIp('PC-COMPTA-01').status).toBe('apipa');
    expect(net.hostIp('PC-COM-01').status).toBe('dhcp');
  });
});

describe('ping', () => {
  it('ping la passerelle et le serveur', () => {
    expect(net.ping('PC-COMPTA-01', '192.168.20.254').result).toBe('ok');
    expect(net.ping('PC-COMPTA-01', '192.168.99.10').result).toBe('ok');
  });

  it('ping inter-VLAN via le routeur', () => {
    const target = net.hostIp('PC-COM-01').ip!;
    expect(net.ping('PC-COMPTA-01', target)).toEqual({ result: 'ok', ttl: 127 });
  });

  it('ping vers une IP inexistante → délai dépassé', () => {
    expect(net.ping('PC-COMPTA-01', '192.168.10.77').result).toBe('timeout');
  });

  it('sans lien → échec général', () => {
    net.unplug(cableOf('PC-COMPTA-01:eth0').id);
    expect(net.ping('PC-COMPTA-01', '192.168.99.10').result).toBe('general');
  });

  it('IP statique erronée (mauvaise passerelle)', () => {
    net.state.hosts['PC-COMPTA-01'].ip = { mode: 'static', ip: '192.168.20.50', mask: '255.255.255.0', gateway: '192.168.20.1', dns: '' };
    net.changed();
    expect(net.ping('PC-COMPTA-01', '192.168.20.254').result).toBe('ok'); // même réseau
    expect(net.ping('PC-COMPTA-01', '192.168.99.10').result).toBe('unreachable');
  });

  it('ping depuis le switch (SVI VLAN 99)', () => {
    expect(net.ping('SW-01', '192.168.99.10').result).toBe('ok');
    expect(net.ping('SW-02', '192.168.99.2').result).toBe('ok');
  });

  it("l'imprimante (IP statique VLAN 30) répond depuis la Compta", () => {
    expect(net.ping('PC-COMPTA-01', '192.168.30.10').result).toBe('ok');
  });
});

describe('table MAC et configuration', () => {
  it('apprend les MAC des postes et des équipements derrière le trunk', () => {
    const t = net.macTable('SW-01');
    const pc = net.host('PC-COMPTA-01')!;
    expect(t).toContainEqual({ vlan: 20, mac: pc.mac, port: 'Fa0/1' });
    const srv = net.host('SRV-01')!;
    expect(t).toContainEqual({ vlan: 99, mac: srv.mac, port: 'Gi0/2' });
  });

  it('un redémarrage sans write memory perd la configuration', () => {
    net.state.switches['SW-01'].running.ports['Fa0/5'].shutdown = true;
    net.changed();
    expect(net.hasUnsavedChanges('SW-01')).toBe(true);
    net.startReboot('SW-01');
    expect(net.portStatus('SW-01', 'Fa0/1')).toBe('notconnect');
    net.finishReboot('SW-01');
    expect(net.portStatus('SW-01', 'Fa0/5')).toBe('connected');
  });

  it('après write memory la configuration survit au redémarrage', () => {
    net.state.switches['SW-01'].running.ports['Fa0/5'].shutdown = true;
    net.writeMemory('SW-01');
    net.startReboot('SW-01');
    net.finishReboot('SW-01');
    expect(net.portStatus('SW-01', 'Fa0/5')).toBe('disabled');
  });

  it("l'état est sérialisable (sauvegarde)", () => {
    const copy = new Network(JSON.parse(JSON.stringify(net.state)));
    expect(copy.hostIp('PC-COMPTA-01').ip).toBe(net.hostIp('PC-COMPTA-01').ip);
  });
});

describe('longueur des cordons', () => {
  it('un cordon de 0,5 m suffit entre le panneau et le switch juste en dessous', () => {
    const a = rackPortPosition('PP-01', '1')!;
    const b = rackPortPosition('SW-01', 'Fa0/1')!;
    expect(patchLengthOk(a, b, 0.5)).toBe(true);
  });
  it('trop court pour aller du panneau au serveur', () => {
    const a = rackPortPosition('PP-01', '1')!;
    const b = rackPortPosition('SRV-01', 'eth1')!;
    expect(patchLengthOk(a, b, 0.5)).toBe(false);
    expect(patchLengthOk(a, b, 1)).toBe(true);
  });
});

describe('boucle et Internet', () => {
  it('un mini-switch branché sur deux prises crée une boucle (tempête de broadcast)', () => {
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
    // Le PC B-07 passe par le mini-switch, qui est relié aux prises B-07 et B-08
    const pcCable = net.cableAt('PC-COM-03:eth0')!;
    net.state.cables = net.state.cables.filter((c) => c !== pcCable && c !== net.cableAt('PC-COM-04:eth0'));
    net.connect('PC-COM-03:eth0', 'SW-PERSO:p1', { kind: 'drop' });
    net.connect('SW-PERSO:p4', 'B-07:jack', { kind: 'drop' });
    net.connect('SW-PERSO:p5', 'B-08:jack', { kind: 'drop' });
    expect(net.portInLoop('SW-01', 'Fa0/7')).toBe(true);
    expect(net.hostIp('PC-COM-01').status).toBe('apipa'); // toute la VLAN 10 est touchée
    expect(net.hostIp('PC-COMPTA-01').status).toBe('dhcp'); // la VLAN 20 non
    // On coupe un des deux ports : la boucle disparaît
    net.state.switches['SW-01'].running.ports['Fa0/8'].shutdown = true;
    net.changed();
    expect(net.portInLoop('SW-01', 'Fa0/7')).toBe(false);
    expect(net.hostIp('PC-COM-03').status).toBe('dhcp');
  });

  it('Internet joignable via la passerelle', () => {
    expect(net.ping('PC-COMPTA-01', '8.8.8.8')).toEqual({ result: 'ok', ttl: 117 });
    net.state.hosts['PC-COMPTA-01'].ip = { mode: 'static', ip: '192.168.20.50', mask: '255.255.255.0', gateway: '', dns: '' };
    net.changed();
    expect(net.ping('PC-COMPTA-01', '8.8.8.8').result).toBe('unreachable');
  });
});
