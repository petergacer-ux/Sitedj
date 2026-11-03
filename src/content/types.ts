/* Types du contenu — pas besoin de modifier ce fichier pour éditer le site. */

export type Photo = {
  /** Chemin de l'image dans /public (ex. "/photos/mariage.jpg"). Vide = emplacement « Photo à venir ». */
  src: string;
  alt: string;
  /** Petit libellé affiché sur l'emplacement tant que la photo n'est pas là. */
  label?: string;
};

export type CouleurAmbiance = "gold" | "magenta" | "cyan" | "violet";

export type Prestation = {
  id: string;
  titre: string;
  accroche: string;
  texte: string;
  points: string[];
  couleur: CouleurAmbiance;
  photo: Photo;
};

export type EtapeDeroule = { titre: string; texte: string };

export type TypeEffet =
  | "fumee"
  | "etincelles"
  | "eclairage"
  | "ondes"
  | "notes"
  | "projecteur";

export type EffetCarte = {
  id: string;
  titre: string;
  texte: string;
  effet: TypeEffet;
};

export type Avis = {
  nom: string;
  evenement: string;
  date?: string;
  texte: string;
  note?: number;
  source?: string;
};
