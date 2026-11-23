import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialNetwork } from '../network/initial';
import { Network } from '../network/Network';
import { IosCli } from './IosCli';

let net: Network;
let cli: IosCli;
const run = (...lines: string[]) => lines.map((l) => cli.exec(l)).join('\n');

beforeEach(() => {
  net = new Network(createInitialNetwork());
  cli = new IosCli(net, 'SW-01');
});

describe('modes et invites', () => {
  it('enable → configure terminal → interface → exit / end', () => {
    expect(cli.prompt).toBe('SW-01>');
    run('enable');
    expect(cli.prompt).toBe('SW-01#');
    expect(run('configure terminal')).toContain('Enter configuration commands');
    expect(cli.prompt).toBe('SW-01(config)#');
    run('interface fastEthernet 0/5');
    expect(cli.prompt).toBe('SW-01(config-if)#');
    expect(cli.ifaces).toEqual(['Fa0/5']);
    run('exit');
    expect(cli.prompt).toBe('SW-01(config)#');
    run('int range fa0/1 - 8');
    expect(cli.prompt).toBe('SW-01(config-if-range)#');
    expect(cli.ifaces).toHaveLength(8);
    run('end');
    expect(cli.prompt).toBe('SW-01#');
  });

  it('les abréviations fonctionnent', () => {
    run('en', 'conf t', 'int fa0/5', 'shut');
    expect(net.portStatus('SW-01', 'Fa0/5')).toBe('disabled');
    run('no shut');
    expect(net.portStatus('SW-01', 'Fa0/5')).toBe('connected');
    run('end');
    expect(run('sh vlan br')).toContain('UTILISATEURS');
  });

  it('commandes de config globale utilisables depuis un sous-mode', () => {
    run('en', 'conf t', 'int fa0/1', 'int fa0/2');
    expect(cli.ifaces).toEqual(['Fa0/2']);
    run('vlan 40', 'name TEST');
    expect(net.state.switches['SW-01'].running.vlans[40]).toBe('TEST');
  });

  it('« do » exécute une commande privilégiée depuis la config', () => {
    run('en', 'conf t');
    expect(run('do show vlan brief')).toContain('COMPTA');
    expect(cli.prompt).toBe('SW-01(config)#');
  });
});

describe('erreurs façon IOS', () => {
  it('commande inconnue : marqueur ^ sous le mot fautif', () => {
    run('en', 'conf t');
    const out = cli.exec('interfce fa0/1');
    expect(out).toContain("% Invalid input detected at '^' marker.");
    const caret = out.split('\n')[0];
    expect(caret.indexOf('^')).toBe('SW-01(config)#'.length);
  });

  it('commande incomplète', () => {
    run('en', 'conf t');
    expect(cli.exec('interface')).toBe('% Incomplete command.');
  });

  it('commande ambiguë', () => {
    run('en');
    expect(cli.exec('c')).toContain('% Ambiguous command');
  });

  it('pas de configure en mode utilisateur', () => {
    expect(cli.exec('configure terminal')).toContain('Invalid input');
  });

  it('port inexistant refusé', () => {
    run('en', 'conf t');
    expect(cli.exec('int fa0/30')).toContain('Invalid input');
  });
});

describe('configuration des ports', () => {
  it('switchport access vlan crée la VLAN si besoin', () => {
    run('en', 'conf t', 'int fa0/12');
    expect(cli.exec('switchport access vlan 50')).toBe('% Access VLAN does not exist. Creating vlan 50');
    expect(net.state.switches['SW-01'].running.vlans[50]).toBe('VLAN0050');
  });

  it('changer la VLAN d’un poste Compta le met dans le mauvais réseau, puis on corrige', () => {
    run('en', 'conf t', 'int fa0/1', 'sw acc vl 10');
    expect(net.hostIp('PC-COMPTA-01').ip).toMatch(/^192\.168\.10\./);
    run('switchport access vlan 20');
    expect(net.hostIp('PC-COMPTA-01').ip).toMatch(/^192\.168\.20\./);
  });

  it('messages LINK/LINEPROTO au shutdown / no shutdown', () => {
    run('en', 'conf t', 'int fa0/3');
    expect(cli.exec('shutdown')).toContain('changed state to administratively down');
    expect(cli.exec('no shutdown')).toContain('Line protocol on Interface FastEthernet0/3, changed state to up');
  });

  it('trunk : allowed vlan remove / add', () => {
    run('en', 'conf t', 'int gi0/2', 'switchport trunk allowed vlan remove 30');
    expect(net.ping('PC-COMPTA-01', '192.168.30.10').result).not.toBe('ok');
    run('switchport trunk allowed vlan add 30');
    expect(net.ping('PC-COMPTA-01', '192.168.30.10').result).toBe('ok');
    run('end');
    expect(run('show interfaces trunk')).toContain('Gi0/2');
  });

  it('description et running-config', () => {
    run('en', 'conf t', 'int fa0/12', 'description Bureau B-12', 'end');
    const rc = run('show running-config');
    expect(rc).toContain('interface FastEthernet0/12\n description Bureau B-12');
    expect(rc).toContain('hostname SW-01');
    expect(rc).toContain('ip address 192.168.99.2 255.255.255.0');
  });

  it('no shutdown réactive un port err-disabled', () => {
    net.state.switches['SW-01'].errDisabled.push('Fa0/4');
    net.changed();
    expect(net.portStatus('SW-01', 'Fa0/4')).toBe('err-disabled');
    run('en', 'conf t', 'int fa0/4', 'shutdown', 'no shutdown');
    expect(net.portStatus('SW-01', 'Fa0/4')).toBe('connected');
  });

  it('port-security stockée dans la config', () => {
    run('en', 'conf t', 'int fa0/5', 'switchport port-security', 'switchport port-security maximum 2', 'end');
    expect(run('sh run int fa0/5')).toContain('switchport port-security maximum 2');
  });
});

describe('affichages', () => {
  it('show vlan brief liste les ports access par VLAN', () => {
    run('en');
    const out = run('show vlan brief');
    expect(out).toMatch(/20\s+COMPTA\s+active\s+Fa0\/1, Fa0\/2, Fa0\/3, Fa0\/4/);
    expect(out).not.toMatch(/Gi0\/1/); // les trunks n'apparaissent pas
  });

  it('show interfaces status', () => {
    run('en');
    const out = run('sh int status');
    expect(out).toMatch(/Fa0\/1\s+Bureau B-01\s+connected\s+20/);
    expect(out).toMatch(/Fa0\/21\s+Non utilise\s+disabled/);
    expect(out).toMatch(/Gi0\/1\s+Uplink RT-FW-01\s+connected\s+trunk/);
  });

  it('show mac address-table', () => {
    run('en');
    const out = run('show mac address-table');
    expect(out).toContain('DYNAMIC     Fa0/1');
    expect(out).toMatch(/Total Mac Addresses for this criterion: \d+/);
  });

  it('ping depuis le switch', () => {
    run('en');
    expect(run('ping 192.168.99.10')).toContain('Success rate is 80 percent');
    expect(run('ping 192.168.99.77')).toContain('Success rate is 0 percent');
  });
});

describe('aide et complétion', () => {
  it('? liste les commandes possibles', () => {
    run('en');
    const h = cli.help('show ');
    expect(h).toContain('vlan');
    expect(h).toContain('running-config');
    expect(cli.help('sh')).toBe('show');
    expect(cli.help('show vlan ')).toContain('<cr>');
  });

  it('Tab complète un mot sans ambiguïté', () => {
    run('en');
    expect(cli.complete('conf')).toBe('configure ');
    expect(cli.complete('configure t')).toBe('configure terminal ');
    expect(cli.complete('c')).toBe('c'); // ambigu (configure, copy, clear)
  });
});

describe('sauvegarde de la configuration', () => {
  it('sans write memory, un reload perd la config', () => {
    run('en', 'conf t', 'int fa0/6', 'shutdown', 'end');
    run('reload');
    expect(cli.prompt).toContain('Save? [yes/no]');
    run('no');
    expect(cli.prompt).toBe('Proceed with reload? [confirm]');
    run('');
    expect(net.state.switches['SW-01'].rebooting).toBe(true);
    net.finishReboot('SW-01');
    expect(net.portStatus('SW-01', 'Fa0/6')).toBe('connected');
  });

  it('copy running-config startup-config conserve la config', () => {
    run('en', 'conf t', 'int fa0/6', 'shutdown', 'end', 'copy running-config startup-config');
    expect(cli.prompt).toBe('Destination filename [startup-config]? ');
    expect(run('')).toContain('[OK]');
    expect(net.hasUnsavedChanges('SW-01')).toBe(false);
    run('reload', '');
    net.finishReboot('SW-01');
    expect(net.portStatus('SW-01', 'Fa0/6')).toBe('disabled');
  });

  it('wr (write memory abrégé)', () => {
    run('en', 'conf t', 'hostname SW-COMPTA', 'end');
    expect(cli.prompt).toBe('SW-COMPTA#');
    expect(run('wr')).toContain('[OK]');
    expect(net.state.switches['SW-01'].startup.hostname).toBe('SW-COMPTA');
  });
});
