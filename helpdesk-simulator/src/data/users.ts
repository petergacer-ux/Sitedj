/**
 * Les utilisateurs (PNJ) de l'entreprise. Ajouter un collègue = ajouter une ligne.
 */

export type Personality = 'patient' | 'presse' | 'raleur' | 'sympa';
export type Service = 'Compta' | 'Commercial' | 'Direction' | 'RH' | 'Juridique' | 'Informatique';

export interface UserDef {
  id: string; // login AD
  firstName: string;
  lastName: string;
  service: Service;
  desk: string; // id du bureau (prise)
  /** Niveau en informatique de 1 (perdu) à 5 (à l'aise). */
  itLevel: 1 | 2 | 3 | 4 | 5;
  personality: Personality;
  /** Couleur des vêtements du personnage 3D. */
  shirt: number;
  hair: number;
  skin: number;
}

export const USERS: UserDef[] = [
  { id: 'jmartin', firstName: 'Julie', lastName: 'Martin', service: 'Compta', desk: 'B-01', itLevel: 2, personality: 'sympa', shirt: 0xc0504d, hair: 0x4a2f1b, skin: 0xf1c7a5 },
  { id: 'kbenali', firstName: 'Karim', lastName: 'Benali', service: 'Compta', desk: 'B-02', itLevel: 4, personality: 'patient', shirt: 0x4f81bd, hair: 0x1b1b1b, skin: 0xc99a6e },
  { id: 'slefevre', firstName: 'Sophie', lastName: 'Lefèvre', service: 'Compta', desk: 'B-03', itLevel: 1, personality: 'raleur', shirt: 0x8064a2, hair: 0xb98b4f, skin: 0xf3d0b5 },
  { id: 'mdubois', firstName: 'Marc', lastName: 'Dubois', service: 'Compta', desk: 'B-04', itLevel: 3, personality: 'presse', shirt: 0x9bbb59, hair: 0x6b5b4b, skin: 0xe8b996 },
  { id: 'tgirard', firstName: 'Thomas', lastName: 'Girard', service: 'Commercial', desk: 'B-05', itLevel: 3, personality: 'presse', shirt: 0x2c4d75, hair: 0x3b2a1a, skin: 0xf0c49e },
  { id: 'lmoreau', firstName: 'Léa', lastName: 'Moreau', service: 'Commercial', desk: 'B-06', itLevel: 2, personality: 'sympa', shirt: 0xf79646, hair: 0x2a1a10, skin: 0xd9a77f },
  { id: 'npetit', firstName: 'Nicolas', lastName: 'Petit', service: 'Commercial', desk: 'B-07', itLevel: 4, personality: 'patient', shirt: 0x4bacc6, hair: 0x8a6a3a, skin: 0xf2c8a8 },
  { id: 'croux', firstName: 'Camille', lastName: 'Roux', service: 'Commercial', desk: 'B-08', itLevel: 2, personality: 'raleur', shirt: 0xd16b9e, hair: 0xa0522d, skin: 0xf5d5bd },
  { id: 'plambert', firstName: 'Philippe', lastName: 'Lambert', service: 'Direction', desk: 'B-09', itLevel: 2, personality: 'presse', shirt: 0x2b2b2b, hair: 0x9a9a9a, skin: 0xe9bf9b },
  { id: 'nfontaine', firstName: 'Nathalie', lastName: 'Fontaine', service: 'RH', desk: 'B-10', itLevel: 3, personality: 'patient', shirt: 0x6a9a7a, hair: 0x5a3a20, skin: 0xf0c8a6 },
  { id: 'amercier', firstName: 'Antoine', lastName: 'Mercier', service: 'Juridique', desk: 'B-11', itLevel: 3, personality: 'raleur', shirt: 0x7a6a5a, hair: 0x2a2a2a, skin: 0xdcae88 },
];

export function getUser(id: string | null | undefined): UserDef | undefined {
  return USERS.find((u) => u.id === id);
}

/** Petites phrases d'accueil selon la personnalité (en attendant les vrais dialogues). */
export const GREETINGS: Record<Personality, string[]> = {
  patient: ['Ah, bonjour ! Tout roule de mon côté pour l’instant.', 'Salut ! Pas de souci aujourd’hui, merci de passer.'],
  presse: ['Oui ? Faites vite, j’ai un rendez-vous dans cinq minutes.', 'Bonjour bonjour… j’ai beaucoup de travail, là.'],
  raleur: ['Ah, l’informatique ! Pour une fois que vous passez…', 'Mon PC est encore lent, comme d’habitude. Mais bon, ça va.'],
  sympa: ['Coucou ! Tu veux un café ? Tout fonctionne nickel !', 'Hello ! Rien à signaler, mais c’est gentil de passer 😊'],
};
