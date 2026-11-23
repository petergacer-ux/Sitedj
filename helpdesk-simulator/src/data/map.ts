/**
 * Plan de l'étage, piloté par des données.
 * Repère : x vers l'est (0 → 40 m), z vers le sud (0 → 24 m), y vers le haut.
 * Le couloir central occupe z = 10 → 14.
 *
 *   z=0  ┌────────┬──────┬────┬──────────┬──────┬──────┐  (fenêtres)
 *        │Helpdesk│Serveur│Imp.│ Réunion  │Direct│  RH  │
 *   z=10 ├──[]────┴──[]──┴─  ─┴───[]─────┴──[]──┴──[]──┤
 *        │                  couloir                     │
 *   z=14 ├─────    ─────┬──────    ──────┬──[]─┬─    ──┤
 *        │ Open space   │  Open space    │Jurid│Cafét.│
 *        │   Compta     │  Commercial    │     │      │
 *   z=24 └──────────────┴────────────────┴─────┴──────┘  (fenêtres)
 */

export const FLOOR_W = 40;
export const FLOOR_D = 24;
export const WALL_H = 3;
export const WALL_T = 0.15;

export interface RoomDef {
  id: string;
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  /** Couleur du sol. */
  floor: number;
}

export const ROOMS: RoomDef[] = [
  { id: 'helpdesk', name: 'Helpdesk', x1: 0, z1: 0, x2: 8, z2: 10, floor: 0x5d6b7a },
  { id: 'serveur', name: 'Salle serveur', x1: 8, z1: 0, x2: 14, z2: 10, floor: 0x9aa3ab },
  { id: 'impression', name: 'Local copieur', x1: 14, z1: 0, x2: 18, z2: 10, floor: 0x7f8790 },
  { id: 'reunion', name: 'Salle de réunion', x1: 18, z1: 0, x2: 28, z2: 10, floor: 0x6e5d52 },
  { id: 'direction', name: 'Direction', x1: 28, z1: 0, x2: 34, z2: 10, floor: 0x5a4a3f },
  { id: 'rh', name: 'Ressources humaines', x1: 34, z1: 0, x2: 40, z2: 10, floor: 0x606d5a },
  { id: 'couloir', name: 'Couloir', x1: 0, z1: 10, x2: 40, z2: 14, floor: 0xb8b2a6 },
  { id: 'compta', name: 'Open space Compta', x1: 0, z1: 14, x2: 14, z2: 24, floor: 0x55657a },
  { id: 'commercial', name: 'Open space Commercial', x1: 14, z1: 14, x2: 30, z2: 24, floor: 0x5b6a5e },
  { id: 'juridique', name: 'Juridique', x1: 30, z1: 14, x2: 35, z2: 24, floor: 0x6b5d6e },
  { id: 'cafeteria', name: 'Cafétéria', x1: 35, z1: 14, x2: 40, z2: 24, floor: 0xa08d6f },
];

/** Un segment de mur aligné sur un axe, avec des ouvertures [début, fin]. */
export interface WallDef {
  axis: 'x' | 'z'; // 'x' : mur le long de l'axe x (à z constant)
  at: number; // coordonnée fixe
  from: number;
  to: number;
  gaps?: [number, number][];
  /** Mur extérieur avec fenêtres. */
  windows?: boolean;
}

export const WALLS: WallDef[] = [
  // Façades
  { axis: 'x', at: 0, from: 0, to: FLOOR_W, windows: true },
  { axis: 'x', at: FLOOR_D, from: 0, to: FLOOR_W, windows: true },
  { axis: 'z', at: 0, from: 0, to: FLOOR_D },
  { axis: 'z', at: FLOOR_W, from: 0, to: FLOOR_D },
  // Côté nord du couloir (portes des bureaux fermés)
  {
    axis: 'x',
    at: 10,
    from: 0,
    to: FLOOR_W,
    gaps: [
      [6, 7],
      [10.5, 11.5],
      [15.4, 16.6],
      [19.5, 20.5],
      [30.5, 31.5],
      [36.5, 37.5],
    ],
  },
  { axis: 'z', at: 8, from: 0, to: 10 },
  { axis: 'z', at: 14, from: 0, to: 10 },
  { axis: 'z', at: 18, from: 0, to: 10 },
  { axis: 'z', at: 28, from: 0, to: 10 },
  { axis: 'z', at: 34, from: 0, to: 10 },
  // Côté sud du couloir (open spaces ouverts)
  {
    axis: 'x',
    at: 14,
    from: 0,
    to: FLOOR_W,
    gaps: [
      [5, 8],
      [20, 23],
      [32, 33],
      [36, 39],
    ],
  },
  { axis: 'z', at: 14, from: 14, to: 24 },
  { axis: 'z', at: 30, from: 14, to: 24 },
  { axis: 'z', at: 35, from: 14, to: 24 },
];

export interface DoorDef {
  id: string;
  /** Mur porteur à z constant. */
  z: number;
  /** Centre de l'ouverture en x. */
  x: number;
  width: number;
  /** +1 : s'ouvre vers le nord (z décroissant), -1 : vers le sud. */
  openDir: 1 | -1;
  locked?: boolean;
  sign: string;
  /** Côté couloir pour le panneau : +1 = panneau au sud du mur. */
  signSide: 1 | -1;
}

export const DOORS: DoorDef[] = [
  { id: 'porte-helpdesk', z: 10, x: 6.5, width: 1, openDir: 1, sign: 'HELPDESK', signSide: 1 },
  { id: 'porte-serveur', z: 10, x: 11, width: 1, openDir: 1, locked: true, sign: 'LOCAL TECHNIQUE', signSide: 1 },
  { id: 'porte-reunion', z: 10, x: 20, width: 1, openDir: 1, sign: 'SALLE DE RÉUNION', signSide: 1 },
  { id: 'porte-direction', z: 10, x: 31, width: 1, openDir: 1, sign: 'DIRECTION', signSide: 1 },
  { id: 'porte-rh', z: 10, x: 37, width: 1, openDir: 1, sign: 'RH', signSide: 1 },
  { id: 'porte-juridique', z: 14, x: 32.5, width: 1, openDir: -1, sign: 'JURIDIQUE', signSide: -1 },
];

/** Panneaux au-dessus des ouvertures sans porte. */
export const OPEN_SIGNS: { x: number; z: number; side: 1 | -1; text: string }[] = [
  { x: 16, z: 10, side: 1, text: 'COPIEUR' },
  { x: 6.5, z: 14, side: -1, text: 'COMPTABILITÉ' },
  { x: 21.5, z: 14, side: -1, text: 'COMMERCIAL' },
  { x: 37.5, z: 14, side: -1, text: 'CAFÉTÉRIA' },
];

/**
 * Un poste de travail. Le bureau est collé contre un mur ;
 * rotY = 0 → mur au nord, rotY = π → mur au sud.
 */
export interface DeskDef {
  id: string; // identifiant de la prise murale, ex. « B-01 »
  room: string;
  x: number;
  z: number;
  rotY: number;
  pcName: string;
  /** Utilisateur assis à ce bureau (null = bureau libre / nouvel arrivant). */
  userId: string | null;
  printer?: boolean;
}

const N = 0;
const S = Math.PI;

export const DESKS: DeskDef[] = [
  { id: 'B-01', room: 'compta', x: 2, z: 23.5, rotY: S, pcName: 'PC-COMPTA-01', userId: 'jmartin' },
  { id: 'B-02', room: 'compta', x: 5.5, z: 23.5, rotY: S, pcName: 'PC-COMPTA-02', userId: 'kbenali' },
  { id: 'B-03', room: 'compta', x: 9, z: 23.5, rotY: S, pcName: 'PC-COMPTA-03', userId: 'slefevre' },
  { id: 'B-04', room: 'compta', x: 12.3, z: 23.5, rotY: S, pcName: 'PC-COMPTA-04', userId: 'mdubois' },
  { id: 'B-05', room: 'commercial', x: 16.5, z: 23.5, rotY: S, pcName: 'PC-COM-01', userId: 'tgirard' },
  { id: 'B-06', room: 'commercial', x: 20, z: 23.5, rotY: S, pcName: 'PC-COM-02', userId: 'lmoreau' },
  { id: 'B-07', room: 'commercial', x: 23.5, z: 23.5, rotY: S, pcName: 'PC-COM-03', userId: 'npetit' },
  { id: 'B-08', room: 'commercial', x: 27, z: 23.5, rotY: S, pcName: 'PC-COM-04', userId: 'croux' },
  { id: 'B-09', room: 'direction', x: 31, z: 0.5, rotY: N, pcName: 'PC-DIR-01', userId: 'plambert', printer: true },
  { id: 'B-10', room: 'rh', x: 37, z: 0.5, rotY: N, pcName: 'PC-RH-01', userId: 'nfontaine' },
  { id: 'B-11', room: 'juridique', x: 32.5, z: 23.5, rotY: S, pcName: 'PC-JUR-01', userId: 'amercier' },
  { id: 'B-12', room: 'commercial', x: 16.5, z: 14.6, rotY: N, pcName: 'PC-COM-05', userId: null },
];

/** Mon poste helpdesk. */
export const MY_DESK = { x: 3, z: 0.5, rotY: N, pcName: 'PC-HELPDESK-01' };

/** Objets particuliers. */
export const SPOTS = {
  spawn: { x: 3, z: 3.2, yaw: 0 },
  shelf: { x: 0.35, z: 4.5 },
  rack: { x: 11, z: 0.9 },
  ups: { x: 12.2, z: 0.6 },
  copier: { x: 16, z: 0.8 },
  coffee: { x: 39.55, z: 18.5 },
  meetingTable: { x: 23, z: 5 },
  networkPrinter: { x: 13.4, z: 15.2 },
};
