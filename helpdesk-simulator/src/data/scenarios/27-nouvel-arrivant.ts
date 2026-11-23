import { DESKS } from '../map';
import { defineScenario } from '../../tickets/types';

/**
 * Nouvel arrivant : créer le compte AD avec les bons groupes, brasser la prise B-12,
 * vérifier la VLAN, allumer le poste et y ouvrir la session du nouvel utilisateur.
 */
export const NEW_HIRE = { firstName: 'Lucas', lastName: 'Bernard', service: 'Commercial', groups: ['GG_Utilisateurs', 'GG_Commercial', 'GG_VPN'] };

export default defineScenario({
  id: 'nouvel-arrivant',
  minLevel: 2,
  category: 'Compte/AD',
  priority: 2,
  titles: ['Arrivée de Lucas BERNARD (Commercial) – bureau B-12'],
  descriptions: [
    'Bonjour,\nMerci de préparer l’arrivée de Lucas BERNARD, commercial, qui commence demain.\n- Bureau : B-12 (open space Commercial)\n- Compte : groupes GG_Utilisateurs, GG_Commercial, GG_VPN\n- Poste : PC-COM-05 (déjà sur le bureau)\nCordialement, Nathalie Fontaine (RH)',
  ],
  eligible: (_ctx, u) => u.id === 'nfontaine',
  inject: () => {},
  fixedTarget: () => ({ user: 'nfontaine', host: 'PC-COM-05', desk: 'B-12', data: {} }),
  isResolved: (ctx) => {
    const u = Object.values(ctx.office.state.ad.users).find((x) => x.firstName.toLowerCase() === 'lucas' && x.lastName.toLowerCase() === 'bernard');
    if (!u || !u.enabled) return false;
    if (!NEW_HIRE.groups.every((g) => u.groups.includes(g))) return false;
    const ip = ctx.net.hostIp('PC-COM-05');
    if (ip.status !== 'dhcp' || ip.vlan !== 10) return false;
    return ctx.office.pc('PC-COM-05')?.user === u.login;
  },
  dialog: {
    describe: ['Il arrive demain à 9h, il lui faut tout : compte, PC, réseau. Les groupes sont dans le ticket.'],
    before: ['Le bureau B-12 vient d’être installé, je ne sais pas si la prise marche.'],
  },
  clues: ['B-12 : prise PP-01 port 12 non brassée', 'Le poste PC-COM-05 est éteint', 'Login à créer : lbernard (initiale + nom)'],
  solution:
    '1) Console AD : créer l’utilisateur Lucas Bernard (lbernard), mot de passe provisoire + « doit changer », groupes GG_Utilisateurs, GG_Commercial, GG_VPN. 2) Baie : brasser PP-01 port 12 vers un port libre de SW-01 en VLAN 10. 3) Allumer PC-COM-05, vérifier l’IP (192.168.10.x). 4) Ouvrir la session avec le compte lbernard.',
  xp: 120,
  solve: (ctx) => {
    ctx.office.createUser({ firstName: 'Lucas', lastName: 'Bernard', service: 'Commercial', password: 'Bienvenue2026', mustChange: true, groups: NEW_HIRE.groups });
    ctx.net.state.hosts['PC-COM-05'].powered = true;
    ctx.net.connect('PP-01:12', 'SW-01:Fa0/12', { kind: 'patch', length: 1 });
    ctx.office.logon('PC-COM-05', 'lbernard');
  },
});

export const NEW_HIRE_DESK = DESKS.find((d) => d.id === 'B-12');
