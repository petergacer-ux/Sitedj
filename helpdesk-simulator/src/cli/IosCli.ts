/**
 * Interpréteur de commandes façon Cisco IOS (switch Catalyst 2960), indépendant de l'affichage.
 *
 * - Arbre de commandes par mode (user >, privilégié #, (config)#, (config-if)#, (config-if-range)#, (config-vlan)#)
 * - Abréviations (conf t, int fa0/5, sh vlan br, no shut), commandes ambiguës, « ? » contextuel, Tab
 * - Messages d'erreur d'IOS : « % Invalid input detected at '^' marker. », « % Incomplete command. »…
 * - Les commandes de configuration globale restent utilisables depuis les sous-modes (comme sur IOS)
 * - La configuration modifiée est la running-config : sans « write memory », elle est perdue au redémarrage.
 */
import { ciscoMac } from '../network/ip';
import { defaultPort, splitRef, type Network } from '../network/Network';
import type { SwitchConfig, SwitchPortConfig } from '../network/types';

export type CliMode = 'user' | 'priv' | 'config' | 'if' | 'range' | 'vlan' | 'svi';

interface Token {
  text: string;
  pos: number;
}

interface Ctx {
  cli: IosCli;
  args: string[];
}

interface Node {
  /** Mot-clé (en minuscules) — ou argument si `arg` est défini. */
  word?: string;
  arg?: { name: string; match: (t: string) => boolean; rest?: boolean };
  help: string;
  children?: Node[];
  run?: (c: Ctx) => string;
}

const kw = (word: string, help: string, children?: Node[], run?: (c: Ctx) => string): Node => ({ word, help, children, run });
const arg = (name: string, help: string, match: (t: string) => boolean, children?: Node[], run?: (c: Ctx) => string, rest = false): Node => ({
  arg: { name, match, rest },
  help,
  children,
  run,
});
const isNum = (min: number, max: number) => (t: string) => /^\d+$/.test(t) && Number(t) >= min && Number(t) <= max;
const any = () => true;

const INVALID = "% Invalid input detected at '^' marker.";

/** Noms d'interfaces : « fa0/5 », « FastEthernet0/5 », « gi0/1 »… */
function ifType(t: string): 'Fa' | 'Gi' | null {
  const l = t.toLowerCase();
  if (l.length >= 1 && 'fastethernet'.startsWith(l)) return 'Fa';
  if (l.length >= 1 && 'gigabitethernet'.startsWith(l)) return 'Gi';
  return null;
}

export function longIfName(short: string): string {
  return short.replace(/^Fa/, 'FastEthernet').replace(/^Gi/, 'GigabitEthernet');
}

/** Découpe « fa0/5 » en « fa » + « 0/5 » (IOS accepte les deux écritures). */
function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const text = m[0];
    const split = /^([a-zA-Z]+)(\d+\/.*)$/.exec(text);
    if (split && ifType(split[1])) {
      tokens.push({ text: split[1], pos: m.index });
      tokens.push({ text: split[2], pos: m.index + split[1].length });
    } else tokens.push({ text, pos: m.index });
  }
  return tokens;
}

/** Liste de VLAN : « 10,20,30-35 ». */
function parseVlanList(s: string): number[] | null {
  const out: number[] = [];
  for (const part of s.split(',')) {
    const r = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!r) return null;
    const a = Number(r[1]);
    const b = r[2] ? Number(r[2]) : a;
    if (a < 1 || b > 4094 || b < a) return null;
    for (let v = a; v <= b; v++) out.push(v);
  }
  return out;
}

export class IosCli {
  mode: CliMode = 'user';
  /** Interfaces en cours de configuration (mode config-if / range). */
  ifaces: string[] = [];
  vlanId: number | null = null;
  history: string[] = [];
  /** Question en attente (copy, reload…) : la prochaine ligne lui répond. */
  pending: { prompt: string; handle: (answer: string) => string } | null = null;
  private trees: Record<CliMode, Node[]>;

  constructor(
    private net: Network,
    readonly switchId: string,
    private hooks: { onReload?: () => void } = {},
  ) {
    this.trees = this.buildTrees();
  }

  private get sw() {
    return this.net.state.switches[this.switchId];
  }

  private get cfg(): SwitchConfig {
    return this.sw.running;
  }

  get busy(): boolean {
    return !!this.sw?.rebooting;
  }

  get prompt(): string {
    if (this.pending) return this.pending.prompt;
    const h = this.cfg.hostname;
    switch (this.mode) {
      case 'user':
        return `${h}>`;
      case 'priv':
        return `${h}#`;
      case 'config':
        return `${h}(config)#`;
      case 'if':
      case 'svi':
        return `${h}(config-if)#`;
      case 'range':
        return `${h}(config-if-range)#`;
      case 'vlan':
        return `${h}(config-vlan)#`;
    }
  }

  // ================================================================ exécution

  /** Exécute une ligne et renvoie la sortie (texte multi-lignes, éventuellement vide). */
  exec(line: string): string {
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      return p.handle(line.trim());
    }
    if (this.busy) return '';
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('!')) return '';
    this.history.push(trimmed);
    if (this.history.length > 50) this.history.shift();
    const prompt = this.prompt;
    const tokens = tokenize(line);
    const r = this.parse(this.trees[this.mode], tokens);
    if (r.ok) return r.node.run!({ cli: this, args: r.args });
    // Dans un sous-mode, on retente avec les commandes de configuration globale.
    if (this.mode === 'if' || this.mode === 'range' || this.mode === 'vlan' || this.mode === 'svi') {
      const g = this.parse(this.trees.config, tokens);
      if (g.ok) {
        this.mode = 'config';
        return g.node.run!({ cli: this, args: g.args });
      }
    }
    return this.errorText(r, prompt, tokens);
  }

  private errorText(r: ParseFail, prompt: string, tokens: Token[]): string {
    if (r.error === 'incomplete') return '% Incomplete command.';
    if (r.error === 'ambiguous') return `% Ambiguous command:  "${tokens.map((t) => t.text).join(' ')}"`;
    const tok = tokens[r.at];
    const caret = ' '.repeat(prompt.length + (tok ? tok.pos : 0)) + '^';
    return `${caret}\n${INVALID}`;
  }

  private parse(tree: Node[], tokens: Token[]): ParseOk | ParseFail {
    let level = tree;
    const args: string[] = [];
    let node: Node | null = null;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].text;
      const low = t.toLowerCase();
      const kws = level.filter((n) => n.word && n.word.startsWith(low));
      const exact = kws.find((n) => n.word === low);
      let chosen: Node | undefined = exact ?? (kws.length === 1 ? kws[0] : undefined);
      if (!chosen && kws.length > 1) return { ok: false, error: 'ambiguous', at: i };
      if (!chosen) {
        chosen = level.find((n) => n.arg && n.arg.match(n.arg.rest ? tokens.slice(i).map((x) => x.text).join(' ') : t));
        if (!chosen) return { ok: false, error: 'invalid', at: i };
        if (chosen.arg!.rest) {
          args.push(tokens.slice(i).map((x) => x.text).join(' '));
          node = chosen;
          break;
        }
        args.push(t);
      }
      node = chosen;
      level = chosen.children ?? [];
    }
    if (!node) return { ok: false, error: 'incomplete', at: 0 };
    if (!node.run) return { ok: false, error: 'incomplete', at: tokens.length };
    return { ok: true, node, args };
  }

  /** Nœuds possibles après les mots déjà tapés (pour ? et Tab). */
  private candidates(line: string): { nodes: Node[]; partial: string; complete: boolean; base: Node | null } {
    const endsWithSpace = /\s$/.test(line) || line.length === 0;
    const tokens = tokenize(line);
    const done = endsWithSpace ? tokens : tokens.slice(0, -1);
    const partial = endsWithSpace ? '' : (tokens.at(-1)?.text ?? '');
    let level = this.trees[this.mode];
    let last: Node | null = null;
    for (const tok of done) {
      const low = tok.text.toLowerCase();
      const kws = level.filter((n) => n.word && n.word.startsWith(low));
      const next = kws.find((n) => n.word === low) ?? (kws.length === 1 ? kws[0] : undefined) ?? level.find((n) => n.arg?.match(tok.text));
      if (!next) return { nodes: [], partial, complete: false, base: null };
      if (next.arg?.rest) return { nodes: [], partial, complete: !!next.run, base: next };
      last = next;
      level = next.children ?? [];
    }
    return { nodes: level, partial, complete: !!last?.run, base: last };
  }

  /** Aide contextuelle « ? » : `line` est ce qui précède le point d'interrogation. */
  help(line: string): string {
    const c = this.candidates(line);
    if (c.partial) {
      const words = c.nodes.filter((n) => n.word?.startsWith(c.partial.toLowerCase())).map((n) => n.word!);
      return words.length ? words.join('  ') : INVALID;
    }
    const lines = c.nodes.map((n) => `  ${(n.word ?? `<${n.arg!.name}>`).padEnd(18)}${n.help}`);
    if (c.complete) lines.push('  <cr>');
    return lines.length ? lines.join('\n') : '% Unrecognized command';
  }

  /** Complétion Tab : renvoie la ligne complétée (ou inchangée si ambigu). */
  complete(line: string): string {
    const c = this.candidates(line);
    if (!c.partial) return line;
    const words = c.nodes.filter((n) => n.word?.startsWith(c.partial.toLowerCase()));
    if (words.length !== 1) return line;
    return line.slice(0, line.length - c.partial.length) + words[0].word + ' ';
  }

  // ================================================================ arbres de commandes

  private buildTrees(): Record<CliMode, Node[]> {
    const showTree = (priv: boolean): Node => {
      const children: Node[] = [
        kw('vlan', 'Affiche les VLAN', [kw('brief', 'Résumé des VLAN', undefined, () => this.showVlanBrief())], () => this.showVlanBrief()),
        kw(
          'interfaces',
          'État et configuration des interfaces',
          [
            kw('status', 'État de tous les ports', undefined, () => this.showIntStatus()),
            kw('trunk', 'Ports en mode trunk', undefined, () => this.showTrunk()),
            ...this.ifTypeNodes((c) => this.showInterface(c.args[0])),
          ],
          () => this.showIntStatus(),
        ),
        kw('ip', 'Informations IP', [kw('interface', 'Interfaces IP', [kw('brief', 'Résumé', undefined, () => this.showIpIntBrief())])]),
        kw('version', 'Version du système', undefined, () => this.showVersion()),
        kw(
          'mac',
          'Table MAC',
          [kw('address-table', 'Adresses MAC apprises', undefined, () => this.showMac())],
        ),
        kw('mac-address-table', 'Adresses MAC apprises', undefined, () => this.showMac()),
        kw('history', 'Historique des commandes', undefined, () => this.history.map((h) => `  ${h}`).join('\n')),
      ];
      if (priv) {
        children.push(
          kw(
            'running-config',
            'Configuration courante (en mémoire vive)',
            [kw('interface', 'Une interface', this.ifTypeNodes((c) => this.runningConfig(c.args[0])))],
            () => this.runningConfig(),
          ),
          kw('startup-config', 'Configuration de démarrage (NVRAM)', undefined, () => this.startupConfig()),
        );
      }
      return kw('show', 'Afficher des informations', children);
    };
    const ping = kw('ping', 'Envoyer des requêtes ICMP echo', [arg('A.B.C.D', 'Adresse IP', (t) => /^\d+\.\d+\.\d+\.\d+$/.test(t), undefined, (c) => this.ping(c.args[0]))]);
    const exitNode = (help: string, run: () => string) => kw('exit', help, undefined, run);

    const user: Node[] = [
      kw('enable', 'Passer en mode privilégié', undefined, () => {
        this.mode = 'priv';
        return '';
      }),
      showTree(false),
      ping,
      exitNode('Quitter la session', () => ''),
      kw('terminal', 'Paramètres du terminal', [kw('length', 'Lignes par page', [arg('0-512', 'Nombre de lignes', isNum(0, 512), undefined, () => '')])]),
    ];

    const writeMem = () => {
      this.net.writeMemory(this.switchId);
      return 'Building configuration...\n[OK]';
    };
    const priv: Node[] = [
      kw('configure', 'Entrer en mode configuration', [
        kw('terminal', 'Configurer depuis le terminal', undefined, () => {
          this.mode = 'config';
          return 'Enter configuration commands, one per line.  End with CNTL/Z.';
        }),
      ]),
      showTree(true),
      ping,
      kw('copy', 'Copier une configuration', [
        kw('running-config', 'Depuis la configuration courante', [
          kw('startup-config', 'Vers la configuration de démarrage', undefined, () => {
            this.pending = {
              prompt: 'Destination filename [startup-config]? ',
              handle: (a) => (a === '' || a === 'startup-config' ? writeMem() : '%Error opening flash:' + a + ' (Permission denied)'),
            };
            return '';
          }),
        ]),
      ]),
      kw('write', 'Écrire la configuration', [kw('memory', 'En NVRAM (startup-config)', undefined, writeMem)], writeMem),
      kw('reload', 'Redémarrer le switch', undefined, () => this.reload()),
      kw('disable', 'Revenir en mode utilisateur', undefined, () => {
        this.mode = 'user';
        return '';
      }),
      kw('clear', 'Réinitialiser', [kw('mac', 'Table MAC', [kw('address-table', 'Table MAC', [kw('dynamic', 'Entrées dynamiques', undefined, () => '')], () => '')])]),
      kw('terminal', 'Paramètres du terminal', [kw('length', 'Lignes par page', [arg('0-512', 'Nombre de lignes', isNum(0, 512), undefined, () => '')])]),
      exitNode('Quitter la session', () => {
        this.mode = 'user';
        return '';
      }),
    ];

    const end = kw('end', 'Revenir en mode privilégié', undefined, () => {
      this.mode = 'priv';
      this.ifaces = [];
      return '';
    });
    const doNode = kw('do', 'Exécuter une commande du mode privilégié', [
      arg('LINE', 'Commande', any, undefined, (c) => this.runAsPriv(c.args[0]), true),
    ]);

    const config: Node[] = [
      kw('interface', 'Sélectionner une interface', [
        ...this.ifTypeNodes((c) => this.enterInterfaces([c.args[0]])),
        kw('range', 'Plage d’interfaces', [
          arg('fa0/1 - 8', 'Plage, ex. fa0/1 - 8, fa0/10', (t) => this.parseRange(t) !== null, undefined, (c) => this.enterInterfaces(this.parseRange(c.args[0])!, true), true),
        ]),
        kw('vlan', 'Interface VLAN (SVI)', [
          arg('1-4094', 'Numéro de VLAN', isNum(1, 4094), undefined, (c) => {
            this.mode = 'svi';
            this.vlanId = Number(c.args[0]);
            return '';
          }),
        ]),
      ]),
      kw('vlan', 'Créer / configurer une VLAN', [
        arg('1-4094', 'Numéro de VLAN', isNum(1, 4094), undefined, (c) => {
          const v = Number(c.args[0]);
          if (!(v in this.cfg.vlans)) this.cfg.vlans[v] = `VLAN${String(v).padStart(4, '0')}`;
          this.vlanId = v;
          this.mode = 'vlan';
          this.net.changed();
          return '';
        }),
      ]),
      kw('hostname', 'Nom du switch', [
        arg('WORD', 'Nouveau nom', (t) => /^[A-Za-z][\w-]{0,62}$/.test(t), undefined, (c) => {
          this.cfg.hostname = c.args[0];
          this.net.changed();
          return '';
        }),
      ]),
      kw('ip', 'Paramètres IP', [
        kw('default-gateway', 'Passerelle par défaut', [
          arg('A.B.C.D', 'Adresse IP', (t) => /^\d+\.\d+\.\d+\.\d+$/.test(t), undefined, (c) => {
            if (this.cfg.mgmt) this.cfg.mgmt.gateway = c.args[0];
            this.net.changed();
            return '';
          }),
        ]),
      ]),
      kw('no', 'Annuler une commande', [
        kw('vlan', 'Supprimer une VLAN', [
          arg('1-4094', 'Numéro de VLAN', isNum(1, 4094), undefined, (c) => {
            const v = Number(c.args[0]);
            if (v === 1) return '%Default VLAN 1 may not be deleted.';
            delete this.cfg.vlans[v];
            this.net.changed();
            return '';
          }),
        ]),
        kw('hostname', 'Nom par défaut', undefined, () => {
          this.cfg.hostname = 'Switch';
          this.net.changed();
          return '';
        }),
      ]),
      kw('spanning-tree', 'Spanning-tree', [kw('mode', 'Mode', [kw('rapid-pvst', 'Rapid PVST+', undefined, () => ''), kw('pvst', 'PVST+', undefined, () => '')])]),
      doNode,
      end,
      exitNode('Quitter le mode configuration', () => {
        this.mode = 'priv';
        return '';
      }),
    ];

    const ifCmds = (): Node[] => [
      kw('switchport', 'Paramètres de port de switch', [
        kw('mode', 'Mode du port', [
          kw('access', 'Port d’accès (une VLAN)', undefined, () => this.setPorts((p) => (p.mode = 'access'))),
          kw('trunk', 'Port trunk (802.1Q)', undefined, () => this.setPorts((p) => (p.mode = 'trunk'))),
        ]),
        kw('access', 'Paramètres du mode access', [
          kw('vlan', 'VLAN d’accès', [arg('1-4094', 'Numéro de VLAN', isNum(1, 4094), undefined, (c) => this.setAccessVlan(Number(c.args[0])))]),
        ]),
        kw('trunk', 'Paramètres du mode trunk', [
          kw('allowed', 'VLAN autorisées', [
            kw('vlan', 'VLAN autorisées sur le trunk', [
              kw('add', 'Ajouter des VLAN', [arg('VLAN_IDS', 'ex. 10,20', (t) => !!parseVlanList(t), undefined, (c) => this.setAllowed('add', c.args[0]))]),
              kw('remove', 'Retirer des VLAN', [arg('VLAN_IDS', 'ex. 30', (t) => !!parseVlanList(t), undefined, (c) => this.setAllowed('remove', c.args[0]))]),
              kw('all', 'Toutes les VLAN', undefined, () => this.setAllowed('all', '')),
              kw('none', 'Aucune VLAN', undefined, () => this.setAllowed('none', '')),
              arg('VLAN_IDS', 'ex. 10,20,30-35', (t) => !!parseVlanList(t), undefined, (c) => this.setAllowed('set', c.args[0])),
            ]),
          ]),
          kw('native', 'VLAN native', [kw('vlan', 'VLAN native', [arg('1-4094', 'Numéro de VLAN', isNum(1, 4094), undefined, (c) => this.setPorts((p) => (p.nativeVlan = Number(c.args[0]))))])]),
          kw('encapsulation', 'Encapsulation', [kw('dot1q', '802.1Q', undefined, () => '')]),
        ]),
        kw(
          'port-security',
          'Sécurité du port',
          [
            kw('maximum', 'Nombre max. d’adresses MAC', [arg('1-132', 'Nombre', isNum(1, 132), undefined, (c) => this.setPortSec((ps) => (ps.maximum = Number(c.args[0]))))]),
            kw('violation', 'Action en cas de violation', [
              kw('shutdown', 'Désactiver le port (err-disable)', undefined, () => this.setPortSec((ps) => (ps.violation = 'shutdown'))),
              kw('restrict', 'Bloquer et journaliser', undefined, () => this.setPortSec((ps) => (ps.violation = 'restrict'))),
              kw('protect', 'Bloquer sans journaliser', undefined, () => this.setPortSec((ps) => (ps.violation = 'protect'))),
            ]),
            kw('mac-address', 'Adresse MAC', [kw('sticky', 'Apprentissage sticky', undefined, () => '')]),
          ],
          () => this.setPortSec((ps) => (ps.enabled = true)),
        ),
      ]),
      kw('shutdown', 'Désactiver l’interface', undefined, () => this.setShutdown(true)),
      kw('description', 'Description de l’interface', [arg('LINE', 'Texte', any, undefined, (c) => this.setPorts((p) => (p.description = c.args[0])), true)]),
      kw('spanning-tree', 'Spanning-tree', [
        kw('portfast', 'Passage immédiat en forwarding', undefined, () => this.setPorts((p) => (p.portfast = true))),
        kw('bpduguard', 'Protection BPDU', [kw('enable', 'Activer', undefined, () => this.setPorts((p) => (p.bpduguard = true)))]),
      ]),
      kw('speed', 'Vitesse', [kw('auto', 'Automatique', undefined, () => ''), kw('100', '100 Mb/s', undefined, () => ''), kw('10', '10 Mb/s', undefined, () => '')]),
      kw('duplex', 'Duplex', [kw('auto', 'Automatique', undefined, () => ''), kw('full', 'Full', undefined, () => ''), kw('half', 'Half', undefined, () => '')]),
      kw('no', 'Annuler une commande', [
        kw('shutdown', 'Réactiver l’interface', undefined, () => this.setShutdown(false)),
        kw('description', 'Supprimer la description', undefined, () => this.setPorts((p) => (p.description = ''))),
        kw('switchport', 'Paramètres de port', [
          kw('access', 'VLAN d’accès', [kw('vlan', 'Revenir en VLAN 1', undefined, () => this.setPorts((p) => (p.accessVlan = 1)))]),
          kw('mode', 'Mode', undefined, () => this.setPorts((p) => (p.mode = 'access'))),
          kw('port-security', 'Désactiver la sécurité du port', undefined, () => this.setPorts((p) => delete p.portSecurity)),
          kw('trunk', 'Trunk', [
            kw('allowed', 'VLAN autorisées', [kw('vlan', 'Toutes', undefined, () => this.setAllowed('all', ''))]),
            kw('native', 'Native', [kw('vlan', 'VLAN 1', undefined, () => this.setPorts((p) => (p.nativeVlan = 1)))]),
          ]),
        ]),
        kw('spanning-tree', 'Spanning-tree', [kw('portfast', 'Portfast', undefined, () => this.setPorts((p) => delete p.portfast))]),
      ]),
      doNode,
      end,
      exitNode('Revenir en mode configuration', () => {
        this.mode = 'config';
        this.ifaces = [];
        return '';
      }),
    ];

    const vlan: Node[] = [
      kw('name', 'Nom de la VLAN', [
        arg('WORD', 'Nom (sans espace)', (t) => /^\S{1,32}$/.test(t), undefined, (c) => {
          if (this.vlanId !== null) this.cfg.vlans[this.vlanId] = c.args[0];
          this.net.changed();
          return '';
        }),
      ]),
      doNode,
      end,
      exitNode('Revenir en mode configuration', () => {
        this.mode = 'config';
        return '';
      }),
    ];

    const svi: Node[] = [
      kw('ip', 'Paramètres IP', [
        kw('address', 'Adresse IP', [
          arg('A.B.C.D', 'Adresse', (t) => /^\d+\.\d+\.\d+\.\d+$/.test(t), [
            arg('A.B.C.D', 'Masque', (t) => /^\d+\.\d+\.\d+\.\d+$/.test(t), undefined, (c) => {
              const gw = this.cfg.mgmt?.gateway ?? '';
              this.cfg.mgmt = { vlan: this.vlanId ?? 1, ip: c.args[0], mask: c.args[1], gateway: gw };
              this.net.changed();
              return '';
            }),
          ]),
        ]),
      ]),
      kw('shutdown', 'Désactiver', undefined, () => ''),
      kw('no', 'Annuler', [kw('shutdown', 'Activer', undefined, () => `%LINK-3-UPDOWN: Interface Vlan${this.vlanId}, changed state to up`)]),
      doNode,
      end,
      exitNode('Revenir en mode configuration', () => {
        this.mode = 'config';
        return '';
      }),
    ];

    return { user, priv, config, if: ifCmds(), range: ifCmds(), vlan, svi };
  }

  /** Nœuds « fastEthernet <0/x> » et « gigabitEthernet <0/x> ». */
  private ifTypeNodes(run: (c: Ctx) => string): Node[] {
    const num = (type: 'Fa' | 'Gi') =>
      arg('0/x', 'Numéro de port', (t) => `${type}${t}` in this.cfg.ports && /^0\/\d+$/.test(t), undefined, (c) => run({ ...c, args: [`${type}${c.args[0]}`] }));
    return [kw('fastethernet', 'FastEthernet IEEE 802.3', [num('Fa')]), kw('gigabitethernet', 'GigabitEthernet IEEE 802.3z', [num('Gi')])];
  }

  /** « fa0/1 - 8, fa0/10 » → [Fa0/1 … Fa0/8, Fa0/10] (null si invalide). */
  parseRange(text: string): string[] | null {
    const compact = text.replace(/\s+/g, '');
    if (!compact) return null;
    const out: string[] = [];
    let type: 'Fa' | 'Gi' | null = null;
    for (const part of compact.split(',')) {
      const m = /^([a-zA-Z]*)0\/(\d+)(?:-(\d+))?$/.exec(part);
      if (!m) return null;
      if (m[1]) type = ifType(m[1]);
      if (!type) return null;
      const a = Number(m[2]);
      const b = m[3] ? Number(m[3]) : a;
      if (b < a) return null;
      for (let i = a; i <= b; i++) {
        const name = `${type}0/${i}`;
        if (!(name in this.cfg.ports)) return null;
        out.push(name);
      }
    }
    return out.length ? out : null;
  }

  private enterInterfaces(list: string[], range = false): string {
    this.ifaces = list;
    this.mode = range ? 'range' : 'if';
    return '';
  }

  private runAsPriv(line: string): string {
    const saved = this.mode;
    this.mode = 'priv';
    const out = this.exec(line);
    if (this.mode === 'priv') this.mode = saved;
    this.history.pop();
    return out;
  }

  // ================================================================ modifications

  private setPorts(fn: (p: SwitchPortConfig) => void): string {
    for (const i of this.ifaces) fn(this.cfg.ports[i]);
    this.net.changed();
    return '';
  }

  private setPortSec(fn: (ps: NonNullable<SwitchPortConfig['portSecurity']>) => void): string {
    const errors: string[] = [];
    for (const i of this.ifaces) {
      const p = this.cfg.ports[i];
      if (p.mode !== 'access') {
        errors.push('Command rejected: FastEthernet0/x is a dynamic port.'.replace('FastEthernet0/x', longIfName(i)));
        continue;
      }
      p.portSecurity ??= { enabled: false, maximum: 1, violation: 'shutdown' };
      fn(p.portSecurity);
    }
    this.net.changed();
    return errors.join('\n');
  }

  private setAccessVlan(v: number): string {
    let msg = '';
    if (!(v in this.cfg.vlans)) {
      this.cfg.vlans[v] = `VLAN${String(v).padStart(4, '0')}`;
      msg = `% Access VLAN does not exist. Creating vlan ${v}`;
    }
    for (const i of this.ifaces) this.cfg.ports[i].accessVlan = v;
    this.net.changed();
    return msg;
  }

  private setAllowed(op: 'add' | 'remove' | 'all' | 'none' | 'set', list: string): string {
    const vl = parseVlanList(list) ?? [];
    for (const i of this.ifaces) {
      const p = this.cfg.ports[i];
      const all = Object.keys(this.cfg.vlans).map(Number);
      const cur = p.allowedVlans ?? Array.from({ length: 4094 }, (_, k) => k + 1);
      if (op === 'all') p.allowedVlans = null;
      else if (op === 'none') p.allowedVlans = [];
      else if (op === 'set') p.allowedVlans = vl;
      else if (op === 'add') p.allowedVlans = [...new Set([...(p.allowedVlans ?? all), ...vl])].sort((a, b) => a - b);
      else p.allowedVlans = cur.filter((v) => !vl.includes(v));
      if (p.allowedVlans && p.allowedVlans.length >= 4094) p.allowedVlans = null;
    }
    this.net.changed();
    return '';
  }

  private setShutdown(down: boolean): string {
    const lines: string[] = [];
    for (const i of this.ifaces) {
      const p = this.cfg.ports[i];
      const before = this.net.portStatus(this.switchId, i);
      p.shutdown = down;
      if (!down) this.sw.errDisabled = this.sw.errDisabled.filter((x) => x !== i);
      this.net.changed();
      const after = this.net.portStatus(this.switchId, i);
      const name = longIfName(i);
      if (down && before !== 'disabled') {
        lines.push(`%LINK-5-CHANGED: Interface ${name}, changed state to administratively down`);
        if (before === 'connected') lines.push(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to down`);
      } else if (!down && before === 'disabled' || (!down && before === 'err-disabled')) {
        if (after === 'connected') {
          lines.push(`%LINK-3-UPDOWN: Interface ${name}, changed state to up`);
          lines.push(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to up`);
        } else lines.push(`%LINK-3-UPDOWN: Interface ${name}, changed state to down`);
      }
    }
    return lines.join('\n');
  }

  private reload(): string {
    const proceed = (): string => {
      this.pending = {
        prompt: 'Proceed with reload? [confirm]',
        handle: (a) => {
          if (a && !/^y/i.test(a)) return '';
          this.mode = 'user';
          this.net.startReboot(this.switchId);
          this.hooks.onReload?.();
          return '\n%SYS-5-RELOAD: Reload requested by console. Reload Reason: Reload Command.\n\nBoot Sector... Loading "flash:c2960-lanbasek9-mz.150-2.SE11.bin"...\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@';
        },
      };
      return '';
    };
    if (this.net.hasUnsavedChanges(this.switchId)) {
      this.pending = {
        prompt: 'System configuration has been modified. Save? [yes/no]: ',
        handle: (a) => {
          if (/^y/i.test(a)) {
            this.net.writeMemory(this.switchId);
            return 'Building configuration...\n[OK]\n' + proceed();
          }
          if (/^n/i.test(a)) return proceed();
          return '% Please answer \'yes\' or \'no\'.';
        },
      };
      return '';
    }
    return proceed();
  }

  // ================================================================ affichages

  private showVlanBrief(): string {
    const lines = ['', 'VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------'];
    const vlans = Object.keys(this.cfg.vlans).map(Number).sort((a, b) => a - b);
    for (const v of vlans) {
      const ports = Object.entries(this.cfg.ports)
        .filter(([, p]) => p.mode === 'access' && p.accessVlan === v)
        .map(([n]) => n)
        .sort(cmpIf);
      const chunks: string[] = [];
      for (let i = 0; i < ports.length; i += 4) chunks.push(ports.slice(i, i + 4).join(', '));
      const head = `${String(v).padEnd(4)} ${this.cfg.vlans[v].padEnd(32)} active    `;
      lines.push(head + (chunks[0] ?? ''));
      for (const c of chunks.slice(1)) lines.push(' '.repeat(head.length) + c);
    }
    for (const [v, n] of [
      [1002, 'fddi-default'],
      [1003, 'token-ring-default'],
      [1004, 'fddinet-default'],
      [1005, 'trnet-default'],
    ] as const) {
      lines.push(`${String(v).padEnd(4)} ${n.padEnd(32)} act/unsup `);
    }
    return lines.join('\n');
  }

  private showIntStatus(): string {
    const lines = ['', 'Port      Name               Status       Vlan       Duplex  Speed Type'];
    for (const [name, p] of Object.entries(this.cfg.ports).sort((a, b) => cmpIf(a[0], b[0]))) {
      const st = this.net.portStatus(this.switchId, name);
      const up = st === 'connected';
      const vlan = p.mode === 'trunk' ? 'trunk' : String(p.accessVlan);
      const gi = name.startsWith('Gi');
      lines.push(
        `${name.padEnd(10)}${p.description.slice(0, 18).padEnd(19)}${st.padEnd(13)}${vlan.padEnd(11)}${(up ? 'a-full' : 'auto').padEnd(8)}${(up ? (gi ? 'a-1000' : 'a-100') : 'auto').padEnd(6)}${gi ? '10/100/1000BaseTX' : '10/100BaseTX'}`,
      );
    }
    return lines.join('\n');
  }

  private showTrunk(): string {
    const trunks = Object.entries(this.cfg.ports).filter(([n, p]) => p.mode === 'trunk' && this.net.portStatus(this.switchId, n) === 'connected');
    if (!trunks.length) return '';
    const lines = ['', 'Port        Mode             Encapsulation  Status        Native vlan'];
    for (const [n, p] of trunks) lines.push(`${n.padEnd(12)}on               802.1q         trunking      ${p.nativeVlan}`);
    lines.push('', 'Port        Vlans allowed on trunk');
    for (const [n, p] of trunks) lines.push(`${n.padEnd(12)}${p.allowedVlans ? compressList(p.allowedVlans) : '1-4094'}`);
    lines.push('', 'Port        Vlans allowed and active in management domain');
    for (const [n, p] of trunks) {
      const active = Object.keys(this.cfg.vlans)
        .map(Number)
        .filter((v) => !p.allowedVlans || p.allowedVlans.includes(v));
      lines.push(`${n.padEnd(12)}${compressList(active)}`);
    }
    return lines.join('\n');
  }

  private showInterface(name: string): string {
    const p = this.cfg.ports[name];
    const st = this.net.portStatus(this.switchId, name);
    const long = longIfName(name);
    const admin = p.shutdown ? 'administratively down' : st === 'connected' ? 'up' : 'down';
    const proto = st === 'connected' ? 'up (connected)' : st === 'err-disabled' ? 'down (err-disabled)' : 'down (notconnect)';
    return [
      `${long} is ${admin}, line protocol is ${proto}`,
      `  Hardware is Fast Ethernet, address is ${ciscoMac(this.portMac(name))} (bia ${ciscoMac(this.portMac(name))})`,
      p.description ? `  Description: ${p.description}` : null,
      '  MTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec,',
      `  ${st === 'connected' ? 'Full-duplex, 100Mb/s' : 'Auto-duplex, Auto-speed'}, media type is 10/100BaseTX`,
      `  Switchport mode: ${p.mode}${p.mode === 'access' ? `, access VLAN ${p.accessVlan}` : `, native VLAN ${p.nativeVlan}`}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private portMac(name: string): string {
    const n = Object.keys(this.cfg.ports).indexOf(name);
    return `00:1b:54:${this.switchId === 'SW-01' ? '11' : '22'}:00:${(n + 1).toString(16).padStart(2, '0')}`;
  }

  private showIpIntBrief(): string {
    const lines = ['Interface              IP-Address      OK? Method Status                Protocol'];
    const mg = this.cfg.mgmt;
    if (mg) lines.push(`${`Vlan${mg.vlan}`.padEnd(23)}${mg.ip.padEnd(16)}YES manual up                    up`);
    for (const [name, p] of Object.entries(this.cfg.ports).sort((a, b) => cmpIf(a[0], b[0]))) {
      const st = this.net.portStatus(this.switchId, name);
      const status = p.shutdown ? 'administratively down' : st === 'connected' ? 'up' : 'down';
      lines.push(`${longIfName(name).padEnd(23)}${'unassigned'.padEnd(16)}YES unset  ${status.padEnd(22)}${st === 'connected' ? 'up' : 'down'}`);
    }
    return lines.join('\n');
  }

  private showVersion(): string {
    return [
      'Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE11, RELEASE SOFTWARE (fc3)',
      'Technical Support: http://www.cisco.com/techsupport',
      '',
      `${this.cfg.hostname} uptime is 12 weeks, 3 days, 4 hours, 51 minutes`,
      'System image file is "flash:c2960-lanbasek9-mz.150-2.SE11.bin"',
      '',
      'cisco WS-C2960-24TT-L (PowerPC405) processor with 65536K bytes of memory.',
      '24 FastEthernet interfaces',
      '2 Gigabit Ethernet interfaces',
      '',
      'Configuration register is 0xF',
    ].join('\n');
  }

  private showMac(): string {
    const entries = this.net.macTable(this.switchId);
    const lines = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----'];
    for (const e of entries) lines.push(`${String(e.vlan).padStart(4)}    ${ciscoMac(e.mac)}    DYNAMIC     ${e.port}`);
    lines.push(`Total Mac Addresses for this criterion: ${entries.length}`);
    return lines.join('\n');
  }

  /** Texte de la running-config (ou d'une config donnée). */
  configText(cfg: SwitchConfig, onlyIf?: string): string {
    const out: string[] = [];
    const ifBlock = (name: string, p: SwitchPortConfig) => {
      out.push(`interface ${longIfName(name)}`);
      if (p.description) out.push(` description ${p.description}`);
      if (p.mode === 'access' && p.accessVlan !== 1) out.push(` switchport access vlan ${p.accessVlan}`);
      if (p.mode === 'trunk' && p.nativeVlan !== 1) out.push(` switchport trunk native vlan ${p.nativeVlan}`);
      if (p.mode === 'trunk' && p.allowedVlans) out.push(` switchport trunk allowed vlan ${compressList(p.allowedVlans) || 'none'}`);
      out.push(` switchport mode ${p.mode}`);
      if (p.portSecurity?.enabled) {
        out.push(' switchport port-security');
        if (p.portSecurity.maximum !== 1) out.push(` switchport port-security maximum ${p.portSecurity.maximum}`);
        if (p.portSecurity.violation !== 'shutdown') out.push(` switchport port-security violation ${p.portSecurity.violation}`);
      }
      if (p.shutdown) out.push(' shutdown');
      if (p.portfast) out.push(' spanning-tree portfast');
      if (p.bpduguard) out.push(' spanning-tree bpduguard enable');
      out.push('!');
    };
    if (onlyIf) {
      out.push('Building configuration...', '', `Current configuration : 120 bytes`, '!');
      ifBlock(onlyIf, cfg.ports[onlyIf]);
      out.push('end');
      return out.join('\n');
    }
    out.push('!', 'version 15.0', 'no service pad', 'service timestamps debug datetime msec', 'service timestamps log datetime msec', 'no service password-encryption', '!', `hostname ${cfg.hostname}`, '!', 'boot-start-marker', 'boot-end-marker', '!', 'no aaa new-model', 'system mtu routing 1500', '!', 'spanning-tree mode pvst', 'spanning-tree extend system-id', '!');
    for (const v of Object.keys(cfg.vlans).map(Number).sort((a, b) => a - b)) {
      if (v === 1) continue;
      out.push(`vlan ${v}`, ` name ${cfg.vlans[v]}`, '!');
    }
    for (const [name, p] of Object.entries(cfg.ports).sort((a, b) => cmpIf(a[0], b[0]))) ifBlock(name, p);
    out.push('interface Vlan1', ' no ip address', ' shutdown', '!');
    if (cfg.mgmt) out.push(`interface Vlan${cfg.mgmt.vlan}`, ` ip address ${cfg.mgmt.ip} ${cfg.mgmt.mask}`, '!', `ip default-gateway ${cfg.mgmt.gateway}`);
    out.push('ip http server', '!', 'line con 0', 'line vty 0 4', ' login', 'line vty 5 15', ' login', '!', 'end');
    const body = out.join('\n');
    return `Building configuration...\n\nCurrent configuration : ${body.length} bytes\n${body}`;
  }

  private runningConfig(onlyIf?: string): string {
    return this.configText(this.cfg, onlyIf);
  }

  private startupConfig(): string {
    return this.configText(this.sw.startup).replace('Building configuration...\n\nCurrent configuration', 'Using 2048 out of 65536 bytes\n\nStartup configuration');
  }

  private ping(ip: string): string {
    const r = this.net.ping(this.switchId, ip);
    const head = `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:`;
    if (r.result === 'ok') return `${head}\n.!!!!\nSuccess rate is 80 percent (4/5), round-trip min/avg/max = 1/2/4 ms`;
    if (r.result === 'unreachable') return `${head}\nU.U.U\nSuccess rate is 0 percent (0/5)`;
    return `${head}\n.....\nSuccess rate is 0 percent (0/5)`;
  }

  /** Infos pour l'interface : la ligne de l'équipement en face d'un port. */
  peerOf(port: string): string | null {
    const p = this.net.link(`${this.switchId}:${port}`).peer;
    return p ? splitRef(p)[0] : null;
  }

  static defaultPort = defaultPort;
}

interface ParseOk {
  ok: true;
  node: Node;
  args: string[];
}
interface ParseFail {
  ok: false;
  error: 'invalid' | 'incomplete' | 'ambiguous';
  at: number;
}

function cmpIf(a: string, b: string): number {
  const ka = (a.startsWith('Gi') ? 1000 : 0) + Number(a.split('/')[1]);
  const kb = (b.startsWith('Gi') ? 1000 : 0) + Number(b.split('/')[1]);
  return ka - kb;
}

/** [10,11,12,20] → « 10-12,20 » */
export function compressList(list: number[]): string {
  const s = [...list].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(j > i ? `${s[i]}-${s[j]}` : String(s[i]));
    i = j + 1;
  }
  return parts.join(',');
}
