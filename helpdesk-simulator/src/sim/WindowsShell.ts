/**
 * Invite de commandes Windows simulée (sorties en français, comme un Windows 10/11 FR).
 * ipconfig [/all|/release|/renew|/flushdns], ping, nslookup, tracert, hostname, whoami, getmac,
 * net use, net user /domain, gpupdate /force, systeminfo, shutdown /r, cls, help, ver, echo.
 */
import { isPrivate } from '../network/Network';
import { DC_IP, DOMAIN, type Office } from './Office';

export interface ShellResult {
  out: string;
  clear?: boolean;
  exit?: boolean;
  reboot?: boolean;
}

const DOTS = (label: string, width = 40) => `   ${label}${' .'.repeat(Math.max(1, Math.floor((width - label.length) / 2)))} : `;

export class WindowsShell {
  constructor(
    private office: Office,
    readonly host: string,
  ) {}

  get prompt(): string {
    const pc = this.office.pc(this.host);
    return `C:\\Users\\${pc?.user ?? 'Administrateur'}>`;
  }

  exec(line: string): ShellResult {
    const raw = line.trim();
    if (!raw) return { out: '' };
    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase().replace(/\.exe$/, '');
    const args = parts.slice(1);
    const flags = args.map((a) => a.toLowerCase());
    switch (cmd) {
      case 'ipconfig':
        return { out: this.ipconfig(flags) };
      case 'ping':
        return { out: this.ping(args) };
      case 'nslookup':
        return { out: this.nslookup(args[0]) };
      case 'tracert':
        return { out: this.tracert(args[0]) };
      case 'hostname':
        return { out: this.host };
      case 'whoami':
        return { out: `${DOMAIN.toLowerCase()}\\${this.office.pc(this.host)?.user ?? 'administrateur'}` };
      case 'getmac':
        return { out: this.getmac() };
      case 'net':
        return { out: this.net(args) };
      case 'gpupdate':
        return { out: this.gpupdate(flags) };
      case 'systeminfo':
        return { out: this.systeminfo() };
      case 'shutdown':
        if (flags.includes('/r')) return { out: 'Le système va redémarrer.', reboot: true };
        return { out: 'Utilisation : shutdown /r [/t 0]   (redémarrer)' };
      case 'cls':
        return { out: '', clear: true };
      case 'exit':
        return { out: '', exit: true };
      case 'ver':
        return { out: '\nMicrosoft Windows [version 10.0.19045.4529]' };
      case 'echo':
        return { out: args.join(' ') };
      case 'help':
      case '/?':
        return {
          out: [
            'Commandes disponibles :',
            '  IPCONFIG [/all | /release | /renew | /flushdns]   Configuration IP',
            '  PING [-n N] hôte                                 Tester la connectivité',
            '  NSLOOKUP nom                                     Interroger le DNS',
            '  TRACERT hôte                                     Suivre l’itinéraire',
            '  NET USE [X: \\\\serveur\\partage | X: /delete]       Lecteurs réseau',
            '  NET USER login /domain                           Infos d’un compte AD',
            '  GPUPDATE /force                                  Réappliquer les stratégies',
            '  HOSTNAME, WHOAMI, GETMAC, SYSTEMINFO, VER',
            '  SHUTDOWN /r                                      Redémarrer le poste',
            '  CLS, EXIT',
          ].join('\n'),
        };
      default:
        return { out: `'${parts[0]}' n’est pas reconnu en tant que commande interne\nou externe, un programme exécutable ou un fichier de commandes.` };
    }
  }

  // ------------------------------------------------------------------ réseau

  private info() {
    const pc = this.office.pc(this.host)!;
    const ip = this.office.net.hostIp(this.host);
    return { pc, ip, host: this.office.net.host(this.host)! };
  }

  private ipconfig(flags: string[]): string {
    const { pc, ip, host } = this.info();
    const header = '\nConfiguration IP de Windows\n';
    if (flags.includes('/flushdns')) return `${header}\nCache de résolution DNS vidé.`;
    if (flags.includes('/release')) {
      if (ip.status === 'disabled') return `${header}\nAucune opération ne peut être effectuée sur Ethernet tant que son média est déconnecté.`;
      if (ip.status === 'disconnected') return `${header}\nAucune opération ne peut être effectuée sur Ethernet tant que son média est déconnecté.`;
      if (host.ip.mode === 'static') return `${header}\nL’adaptateur Ethernet n’est pas configuré pour DHCP : aucune adresse à libérer.`;
      pc.released = true;
      this.office.changed();
      return `${header}\nCarte Ethernet Ethernet :\n\n${DOTS('Suffixe DNS propre à la connexion')}\n${DOTS('Passerelle par défaut')}`;
    }
    if (flags.includes('/renew')) {
      if (ip.status === 'disconnected' || ip.status === 'disabled') return `${header}\nAucune opération ne peut être effectuée sur Ethernet tant que son média est déconnecté.`;
      if (host.ip.mode === 'static') return `${header}\nL’adaptateur Ethernet n’est pas configuré pour DHCP.`;
      pc.released = false;
      this.office.changed();
      const now = this.office.net.hostIp(this.host);
      if (now.status === 'apipa') {
        return `${header}\nUne erreur s’est produite lors du renouvellement de l’interface Ethernet :\nimpossible de contacter votre serveur DHCP. Le délai d’attente de la demande a expiré.`;
      }
      return this.ipconfig([]);
    }
    const all = flags.includes('/all');
    const lines = [header];
    if (all) {
      lines.push(`${DOTS('Nom de l’hôte')}${this.host}`, `${DOTS('Suffixe DNS principal')}entreprise.local`, `${DOTS('Type de noeud')}Hybride`, `${DOTS('Routage IP activé')}Non`, '');
    }
    if (ip.status === 'disabled' || ip.status === 'off') return lines.join('\n');
    lines.push('Carte Ethernet Ethernet :', '');
    if (ip.status === 'disconnected') {
      lines.push(`${DOTS('Statut du média')}Média déconnecté`, `${DOTS('Suffixe DNS propre à la connexion')}`);
      if (all) lines.push(`${DOTS('Description')}Intel(R) Ethernet Connection I219-LM`, `${DOTS('Adresse physique')}${host.mac.replace(/:/g, '-')}`);
      return lines.join('\n');
    }
    const dhcp = host.ip.mode === 'dhcp';
    lines.push(`${DOTS('Suffixe DNS propre à la connexion')}${ip.status === 'dhcp' && !pc.released ? 'entreprise.local' : ''}`);
    if (all) {
      lines.push(
        `${DOTS('Description')}Intel(R) Ethernet Connection I219-LM`,
        `${DOTS('Adresse physique')}${host.mac.replace(/:/g, '-')}`,
        `${DOTS('DHCP activé')}${dhcp ? 'Oui' : 'Non'}`,
        `${DOTS('Configuration automatique activée')}Oui`,
      );
    }
    if (pc.released) {
      lines.push(`${DOTS('Adresse IPv4')}0.0.0.0`, `${DOTS('Masque de sous-réseau')}0.0.0.0`, `${DOTS('Passerelle par défaut')}`);
      return lines.join('\n');
    }
    if (ip.status === 'apipa') {
      lines.push(`${DOTS('Adresse d’autoconfiguration IPv4')}${ip.ip}(préféré)`, `${DOTS('Masque de sous-réseau')}${ip.mask}`, `${DOTS('Passerelle par défaut')}`);
    } else {
      lines.push(`${DOTS('Adresse IPv4')}${ip.ip}${all ? '(préféré)' : ''}`, `${DOTS('Masque de sous-réseau')}${ip.mask}`, `${DOTS('Passerelle par défaut')}${ip.gateway ?? ''}`);
      if (all) {
        if (dhcp) lines.push(`${DOTS('Serveur DHCP')}${DC_IP}`, `${DOTS('Bail obtenu')}lundi 08:12:03`);
        lines.push(`${DOTS('Serveurs DNS')}${ip.dns ?? ''}`, `${DOTS('NetBIOS sur Tcpip')}Activé`);
      }
    }
    return lines.join('\n');
  }

  private resolve(target: string): { ip: string | null; dnsDown: boolean } {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) return { ip: target, dnsDown: false };
    const ip = this.office.net.hostIp(this.host);
    const pc = this.office.pc(this.host)!;
    const dns = ip.dns;
    if (!dns || pc.released || this.office.net.ping(this.host, dns).result !== 'ok') return { ip: null, dnsDown: true };
    return { ip: this.office.resolveName(target), dnsDown: false };
  }

  private ping(args: string[]): string {
    let count = 4;
    const target = args.filter((a, i) => !a.startsWith('-') && !(args[i - 1] === '-n'))[0];
    const ni = args.indexOf('-n');
    if (ni >= 0) count = Math.min(10, Math.max(1, Number(args[ni + 1]) || 4));
    if (!target) return 'Utilisation : ping [-n nombre] nom_de_la_cible';
    const { pc } = this.info();
    const r = this.resolve(target);
    if (!r.ip) return `La requête Ping n’a pas pu trouver l’hôte ${target}. Vérifiez le nom et essayez à nouveau.`;
    const head = `\nEnvoi d’une requête 'Ping'  ${target !== r.ip ? `${target} [${r.ip}] ` : `${r.ip} `}avec 32 octets de données :`;
    const res = pc.released ? { result: 'general' as const } : this.office.net.ping(this.host, r.ip);
    const lines = [head];
    let received = 0;
    for (let i = 0; i < count; i++) {
      if (res.result === 'ok') {
        const t = isPrivate(r.ip) ? '<1ms' : `=${12 + ((i * 7) % 5)} ms`;
        lines.push(`Réponse de ${r.ip} : octets=32 temps${t} TTL=${res.ttl}`);
        received++;
      } else if (res.result === 'unreachable') {
        lines.push(`Réponse de ${res.from} : Impossible de joindre l’hôte de destination.`);
      } else if (res.result === 'timeout') lines.push('Délai d’attente de la demande dépassé.');
      else lines.push('PING : échec de la transmission. Défaillance générale.');
    }
    const recvCount = res.result === 'unreachable' ? count : received;
    lines.push(
      '',
      `Statistiques Ping pour ${r.ip}:`,
      `    Paquets : envoyés = ${count}, reçus = ${recvCount}, perdus = ${count - recvCount} (perte ${Math.round(((count - recvCount) / count) * 100)}%),`,
    );
    if (received) lines.push('Durée approximative des boucles en millisecondes :', `    Minimum = 0ms, Maximum = ${isPrivate(r.ip) ? 1 : 16}ms, Moyenne = ${isPrivate(r.ip) ? 0 : 13}ms`);
    return lines.join('\n');
  }

  private nslookup(name: string | undefined): string {
    const ip = this.office.net.hostIp(this.host);
    const dns = ip.dns ?? DC_IP;
    const pc = this.office.pc(this.host)!;
    const reachable = !!ip.dns && !pc.released && this.office.net.ping(this.host, dns).result === 'ok';
    if (!reachable) {
      return `DNS request timed out.\n    timeout was 2 seconds.\nServeur :   UnKnown\nAddress:  ${dns}\n\n${name ? `*** Le délai de la requête sur UnKnown a expiré` : ''}`;
    }
    const head = `Serveur :   srv-01.entreprise.local\nAddress:  ${dns}\n`;
    if (!name) return head;
    const res = this.office.resolveName(name);
    if (!res) return `${head}\n*** srv-01.entreprise.local ne parvient pas à trouver ${name} : Non-existent domain`;
    const fqdn = name.includes('.') ? name : `${name.toLowerCase()}.entreprise.local`;
    return `${head}\n${isPrivate(res) ? '' : 'Réponse ne faisant pas autorité :\n'}Nom :    ${fqdn}\nAddress:  ${res}`;
  }

  private tracert(target: string | undefined): string {
    if (!target) return 'Utilisation : tracert nom_de_la_cible';
    const r = this.resolve(target);
    if (!r.ip) return `Impossible de résoudre le nom système de la cible ${target}.`;
    const ip = this.office.net.hostIp(this.host);
    const res = this.office.net.ping(this.host, r.ip);
    const lines = [`\nDétermination de l’itinéraire vers ${target} [${r.ip}]`, 'avec un maximum de 30 sauts :', ''];
    const sameNet = ip.ip && ip.mask && ip.ip.split('.').slice(0, 3).join('.') === r.ip.split('.').slice(0, 3).join('.');
    if (res.result === 'ok') {
      if (!sameNet && ip.gateway) lines.push(`  1    <1 ms    <1 ms    <1 ms  rt-fw-01.entreprise.local [${ip.gateway}]`);
      if (!isPrivate(r.ip)) lines.push('  2     8 ms     7 ms     8 ms  box-fai.isp.net [82.64.12.1]', '  3    12 ms    11 ms    12 ms  core1.isp.net [193.251.10.4]');
      lines.push(`  ${!sameNet ? (isPrivate(r.ip) ? 2 : 4) : 1}    <1 ms    <1 ms    <1 ms  ${r.ip}`);
    } else {
      if (ip.gateway && res.result !== 'general') lines.push(`  1    <1 ms    <1 ms    <1 ms  ${ip.gateway}`);
      lines.push(`  ${ip.gateway ? 2 : 1}     *        *        *     Délai d’attente de la demande dépassé.`, `  ${ip.gateway ? 3 : 2}     *        *        *     Délai d’attente de la demande dépassé.`);
    }
    lines.push('', 'Itinéraire déterminé.');
    return lines.join('\n');
  }

  private getmac(): string {
    const { host, ip } = this.info();
    return `\nAdresse physique    Nom du transport\n=================== ==========================================================\n${host.mac.replace(/:/g, '-')}   ${ip.status === 'disconnected' ? 'Média déconnecté' : '\\Device\\Tcpip_{3F2A9C1E-7B44-4E1A-9D21-6C0E2B5A1F77}'}`;
  }

  // ------------------------------------------------------------------ net use / net user

  private net(args: string[]): string {
    const sub = (args[0] ?? '').toLowerCase();
    if (sub === 'use') return this.netUse(args.slice(1));
    if (sub === 'user') return this.netUser(args.slice(1));
    return 'La syntaxe de cette commande est :\n\nNET\n    [ USE | USER ]';
  }

  private netUse(args: string[]): string {
    const pc = this.office.pc(this.host)!;
    if (!args.length) {
      const lines = ['Les nouvelles connexions seront mémorisées.', '', '', 'État         Local     Distant                   Réseau', '', '-------------------------------------------------------------------------------'];
      for (const d of pc.drives) {
        const ok = this.office.shareAccess(this.host, d.path) === 0;
        lines.push(`${(ok ? 'OK' : 'Indisponible').padEnd(13)}${d.letter.padEnd(10)}${d.path.padEnd(26)}Microsoft Windows Network`);
      }
      lines.push('La commande s’est terminée correctement.');
      return lines.join('\n');
    }
    const letter = args[0].toUpperCase();
    if (!/^[A-Z]:$/.test(letter)) return 'Erreur système 67.\n\nNom de réseau introuvable.';
    if ((args[1] ?? '').toLowerCase() === '/delete' || (args[1] ?? '').toLowerCase() === '/d') {
      return this.office.unmapDrive(this.host, letter) ? `${letter} a été supprimé.` : 'La connexion réseau est introuvable.\n\nVous obtiendrez une aide supplémentaire en entrant NET HELPMSG 2250.';
    }
    const path = args[1];
    if (!path || !path.startsWith('\\\\')) return 'La syntaxe de cette commande est :\n\nNET USE\n[nom_de_périphérique] [\\\\ordinateur\\partage] [/DELETE]';
    const code = this.office.mapDrive(this.host, letter, path);
    switch (code) {
      case 0:
        return 'La commande s’est terminée correctement.';
      case 5:
        return 'Erreur système 5.\n\nAccès refusé.';
      case 53:
        return 'Erreur système 53.\n\nLe chemin réseau n’a pas été trouvé.';
      case 67:
        return 'Erreur système 67.\n\nNom de réseau introuvable.';
      case 85:
        return 'Erreur système 85.\n\nLe nom de périphérique local est déjà utilisé.';
    }
  }

  private netUser(args: string[]): string {
    const login = args[0];
    if (!login) return 'Utilisation : NET USER login /domain';
    if (!args.some((a) => a.toLowerCase() === '/domain')) return `Le nom d’utilisateur est introuvable.\n\nVous obtiendrez une aide supplémentaire en entrant NET HELPMSG 2221.`;
    if (!this.office.dcReachable(this.host)) return `Une erreur s’est produite lors de la recherche du contrôleur de domaine pour le domaine ${DOMAIN}.`;
    const u = this.office.user(login);
    if (!u) return 'Le nom d’utilisateur est introuvable.\n\nVous obtiendrez une aide supplémentaire en entrant NET HELPMSG 2221.';
    const groups = u.groups.map((g) => `*${g}`);
    const rows: string[] = [];
    for (let i = 0; i < groups.length; i += 2) rows.push(groups.slice(i, i + 2).map((g) => g.padEnd(25)).join(''));
    return [
      `Nom d’utilisateur                      ${u.login}`,
      `Nom complet                            ${u.firstName} ${u.lastName}`,
      `Commentaire                            ${u.service}`,
      `Compte : actif                         ${u.enabled ? (u.locked ? 'Verrouillé' : 'Oui') : 'Non'}`,
      `Le compte expire                       Jamais`,
      '',
      `Mot de passe expiré                    ${u.passwordExpired ? 'Oui' : 'Non'}`,
      `L’utilisateur doit changer de mot de passe ${u.mustChangePassword ? 'Oui' : 'Non'}`,
      '',
      `Appartient aux groupes globaux         ${rows[0] ?? '*Aucun'}`,
      ...rows.slice(1).map((r) => `                                       ${r}`),
      'La commande s’est terminée correctement.',
    ].join('\n');
  }

  private gpupdate(flags: string[]): string {
    const head = 'Mise à jour de la stratégie...\n';
    if (!this.office.gpupdate(this.host)) {
      return `${head}\nImpossible de mettre à jour la stratégie d’ordinateur. Les erreurs suivantes ont été rencontrées :\n\nLe traitement de la stratégie de groupe a échoué. Windows n’a pas pu déterminer le nom de cet ordinateur. Cela peut être dû à l’un des motifs suivants :\na) Échec de la résolution de nom sur le contrôleur de domaine actuel.\nb) Latence de réplication.`;
    }
    return `${head}\nLa mise à jour de la stratégie d’ordinateur s’est terminée sans erreur.\nLa mise à jour de la stratégie utilisateur s’est terminée sans erreur.${flags.includes('/force') ? '' : ''}`;
  }

  private systeminfo(): string {
    const pc = this.office.pc(this.host)!;
    return [
      '',
      `Nom de l’hôte:                              ${this.host}`,
      'Nom du système d’exploitation:              Microsoft Windows 10 Professionnel',
      'Version du système:                         10.0.19045 N/A version 19045',
      'Fabricant du système d’exploitation:        Microsoft Corporation',
      'Fabricant du système:                       Dell Inc.',
      'Modèle du système:                          OptiPlex 7090',
      `Mémoire physique totale:                    ${fmtNum(pc.ramGb * 1024)} Mo`,
      `Mémoire physique disponible:                ${fmtNum(Math.max(200, pc.ramGb * 1024 - 3600))} Mo`,
      `Domaine:                                    entreprise.local`,
      `Serveur d’ouverture de session:             \\\\SRV-01`,
    ].join('\n');
  }
}

/** 4096 → « 4 096 » (séparateur des milliers à la française). */
function fmtNum(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
