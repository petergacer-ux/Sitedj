import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialNetwork } from '../network/initial';
import { Network } from '../network/Network';
import { Office, createInitialOffice, makeLogin, passwordComplexityError } from './Office';
import { WindowsShell } from './WindowsShell';

let net: Network;
let office: Office;
let sh: WindowsShell;
beforeEach(() => {
  net = new Network(createInitialNetwork());
  office = new Office(net, createInitialOffice());
  sh = new WindowsShell(office, 'PC-COMPTA-01');
});
const run = (l: string) => sh.exec(l).out;

describe('Active Directory', () => {
  it('login à la française sans accents', () => {
    expect(makeLogin('Léa', 'Moreau')).toBe('lmoreau');
    expect(makeLogin('Éloïse', 'De La Tour')).toBe('edelatour');
  });
  it('stratégie de mot de passe', () => {
    expect(passwordComplexityError('abc')).not.toBeNull();
    expect(passwordComplexityError('motdepasse')).not.toBeNull();
    expect(passwordComplexityError('Bienvenue2026')).toBeNull();
  });
  it('création de compte avec groupes', () => {
    const u = office.createUser({ firstName: 'Lucas', lastName: 'Bernard', service: 'Commercial', password: 'Bienvenue2026', mustChange: true, groups: ['GG_Commercial', 'GG_Utilisateurs'] });
    expect(typeof u).not.toBe('string');
    expect(office.user('lbernard')?.groups).toContain('GG_Commercial');
    expect(office.createUser({ firstName: 'Lucas', lastName: 'Bernard', service: 'Commercial', password: 'Bienvenue2026', mustChange: true, groups: [] })).toMatch(/existe déjà/);
  });
  it('compte verrouillé : ouverture de session refusée puis acceptée après déverrouillage', () => {
    office.user('jmartin')!.locked = true;
    expect(office.logon('PC-COMPTA-01', 'jmartin')).toMatch(/verrouillé/);
    office.unlock('jmartin');
    expect(office.logon('PC-COMPTA-01', 'jmartin')).toBeNull();
  });
});

describe('partages et jeton de session', () => {
  it('le lecteur S: Compta est mappé pour les comptables', () => {
    expect(office.driveWorks('PC-COMPTA-01', 'S:')).toBe(true);
    expect(office.driveWorks('PC-COMPTA-01', 'P:')).toBe(true);
  });
  it('sans le groupe, accès refusé ; il faut une nouvelle session après ajout au groupe', () => {
    office.removeFromGroup('jmartin', 'GG_Compta');
    office.reboot('PC-COMPTA-01', 0, 0);
    office.tick(1);
    // Après la nouvelle session, la GPO ne mappe plus S: (plus dans le groupe)
    expect(office.pc('PC-COMPTA-01')!.drives.some((d) => d.letter === 'S:')).toBe(false);
    expect(run('net use S: \\\\SRV-FICHIERS\\Compta')).toContain('Erreur système 5');
    office.addToGroup('jmartin', 'GG_Compta');
    // Toujours refusé : le jeton de session n'a pas changé
    expect(run('net use S: \\\\SRV-FICHIERS\\Compta')).toContain('Erreur système 5');
    office.reboot('PC-COMPTA-01', 0, 0);
    office.tick(1);
    expect(office.driveWorks('PC-COMPTA-01', 'S:')).toBe(true);
  });
  it('gpupdate /force remappe les lecteurs perdus', () => {
    run('net use S: /delete');
    expect(office.driveWorks('PC-COMPTA-01', 'S:')).toBe(false);
    expect(run('gpupdate /force')).toContain('sans erreur');
    expect(office.driveWorks('PC-COMPTA-01', 'S:')).toBe(true);
  });
  it('sans réseau : erreur 53 et gpupdate en échec', () => {
    net.unplug(net.cableAt('PC-COMPTA-01:eth0')!.id);
    run('net use S: /delete');
    expect(run('net use S: \\\\SRV-FICHIERS\\Compta')).toContain('Erreur système 53');
    expect(run('gpupdate /force')).toContain('Impossible de mettre à jour');
  });
});

describe('invite de commandes', () => {
  it('ipconfig affiche l’IP DHCP', () => {
    const out = run('ipconfig');
    expect(out).toContain('Carte Ethernet Ethernet');
    expect(out).toMatch(/Adresse IPv4[ .]*: 192\.168\.20\.\d+/);
    expect(out).toContain('192.168.20.254');
  });
  it('ipconfig : média déconnecté', () => {
    net.unplug(net.cableAt('PC-COMPTA-01:eth0')!.id);
    expect(run('ipconfig')).toContain('Média déconnecté');
  });
  it('ipconfig : APIPA', () => {
    net.state.switches['SW-01'].running.ports['Fa0/1'].accessVlan = 1;
    net.changed();
    expect(run('ipconfig')).toMatch(/autoconfiguration IPv4[ .]*: 169\.254\./);
    expect(run('ipconfig /renew')).toContain('impossible de contacter votre serveur DHCP');
  });
  it('ipconfig /release puis /renew', () => {
    expect(run('ipconfig /release')).toContain('Carte Ethernet');
    expect(run('ipconfig')).toContain('0.0.0.0');
    expect(run('ping 192.168.20.254')).toContain('Défaillance générale');
    expect(run('ipconfig /renew')).toMatch(/192\.168\.20\./);
  });
  it('ipconfig /all montre la MAC, le DHCP et le DNS', () => {
    const out = run('ipconfig /all');
    expect(out).toContain('Adresse physique');
    expect(out).toContain('Serveur DHCP');
    expect(out).toContain('192.168.99.10');
  });
  it('ping par nom via le DNS, et vers Internet', () => {
    expect(run('ping srv-fichiers')).toContain('Réponse de 192.168.99.10');
    expect(run('ping www.google.fr')).toContain('TTL=117');
    expect(run('ping serveur-inconnu')).toContain('n’a pas pu trouver l’hôte');
  });
  it('ping : délai dépassé / hôte inaccessible', () => {
    expect(run('ping 192.168.20.199')).toContain('Impossible de joindre l’hôte de destination');
    expect(run('ping 192.168.10.199')).toContain('Délai d’attente de la demande dépassé');
  });
  it('nslookup', () => {
    expect(run('nslookup srv-fichiers')).toContain('Address:  192.168.99.10');
    expect(run('nslookup inconnu.entreprise.local')).toContain('Non-existent domain');
  });
  it('net user /domain montre l’état du compte', () => {
    office.user('jmartin')!.locked = true;
    expect(run('net user jmartin /domain')).toContain('Verrouillé');
    expect(run('net user jmartin /domain')).toContain('*GG_Compta');
  });
  it('whoami / hostname / commande inconnue', () => {
    expect(run('whoami')).toBe('entreprise\\jmartin');
    expect(run('hostname')).toBe('PC-COMPTA-01');
    expect(run('toto')).toContain('n’est pas reconnu');
  });
  it('systeminfo indique la RAM', () => {
    office.pc('PC-COMPTA-01')!.ramGb = 4;
    expect(run('systeminfo')).toContain('4 096 Mo');
  });
});

describe('impression et stock', () => {
  it('l’imprimante Compta fonctionne, puis panne de toner', () => {
    expect(office.printProblems('PC-COMPTA-01', 'IMP-COMPTA')).toEqual([]);
    office.state.printers['IMP-COMPTA'].toner = 0;
    expect(office.printProblems('PC-COMPTA-01', 'IMP-COMPTA')).toContain('Toner vide');
  });
  it('imprimante dans le mauvais VLAN = injoignable', () => {
    net.state.switches['SW-02'].running.ports['Fa0/2'].accessVlan = 10;
    net.changed();
    expect(office.printProblems('PC-COMPTA-01', 'IMP-COMPTA')).toContain('Imprimante injoignable sur le réseau');
  });
  it('prendre et reposer du matériel', () => {
    const before = office.state.stock.rj45;
    expect(office.takeItem('rj45')).toBeNull();
    expect(office.state.stock.rj45).toBe(before - 1);
    expect(office.hasItem('rj45')).toBe(true);
    office.consume('rj45');
    expect(office.hasItem('rj45')).toBe(false);
    office.takeItem('tester');
    office.consume('tester'); // outil : pas consommé
    expect(office.hasItem('tester')).toBe(true);
  });
  it('réassort tous les 3 jours', () => {
    office.state.stock.toner = 0;
    expect(office.restock(2)).toBe(false);
    expect(office.restock(4)).toBe(true);
    expect(office.state.stock.toner).toBe(3);
  });
});
