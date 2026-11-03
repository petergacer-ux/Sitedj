/* ==========================================================================
   MILLENIUM DJ ANIMATION — CONTENU DU SITE
   --------------------------------------------------------------------------
   C'est le SEUL fichier à modifier pour changer les textes, les options,
   les styles musicaux, la FAQ, les avis et les photos.

   • Tout ce qui contient « [À COMPLÉTER] » est une information manquante :
     elle s'affiche en pointillés dorés sur le site tant qu'elle n'est pas
     remplacée. La liste complète est dans le README.
   • Photos : déposez vos fichiers dans /public/photos/ puis indiquez le
     chemin dans le champ `src` (ex. "/photos/mariage-1.jpg").
     Tant que `src` est vide, un emplacement animé « Photo à venir »
     est affiché.
   • Avis : ajoutez uniquement de VRAIS avis dans `avis.liste`.
     Tant que la liste est vide, la section est masquée automatiquement.
   ========================================================================== */

import type {
  Avis,
  EffetCarte,
  EtapeDeroule,
  Photo,
  Prestation,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Identité & coordonnées                                                     */
/* -------------------------------------------------------------------------- */

export const entreprise = {
  nom: "Millenium DJ Animation",
  nomCourt: "Millenium DJ",
  slogan: "Le partenaire de vos réceptions",
  metiers: ["Animation", "Sonorisation", "Éclairage"],
  evenements: [
    "Mariages",
    "Anniversaires",
    "Soirées d'entreprise",
    "Cocktails",
    "Événementiel",
  ],
  telephone: "06 80 65 64 63",
  telephoneLien: "tel:+33680656463",
  email: "dj2g@orange.fr",
  adresse: {
    rue: "1 square du Pont Vert",
    codePostal: "95310",
    ville: "Saint-Ouen-l'Aumône",
    departement: "Val-d'Oise",
  },
  /** Zone d'intervention (villes, départements, distance max…) */
  zoneIntervention: "[À COMPLÉTER : zone d'intervention]",
  /** Adresse publique du site, ex. "https://www.millenium-dj.fr" (sert au référencement). */
  urlSite: "",
  /** Logo : laissez vide pour le logo typographique, ou mettez "/logo.svg" (fichier dans /public). */
  logo: "",
  /** Réseaux sociaux : ajoutez uniquement ceux qui existent vraiment. */
  reseaux: [] as { nom: string; url: string }[],
};

/* -------------------------------------------------------------------------- */
/* Envoi des formulaires                                                       */
/* -------------------------------------------------------------------------- */

export const formulaires = {
  /**
   * Adresse d'un service d'envoi de formulaire (Formspree, Getform, Web3Forms…).
   * Exemple : "https://formspree.io/f/abcdwxyz".
   * Si laissé vide, le formulaire ouvre la messagerie du visiteur avec un
   * e-mail pré-rempli adressé à entreprise.email.
   */
  endpoint: "",
  messageSucces:
    "Merci ! Votre demande est bien partie. Je reviens vers vous très vite.",
  messageErreur:
    "Oups, l'envoi n'a pas fonctionné. Vous pouvez m'appeler ou m'écrire directement.",
};

/* -------------------------------------------------------------------------- */
/* Navigation                                                                  */
/* -------------------------------------------------------------------------- */

export const navigation = [
  { label: "Prestations", href: "/#prestations" },
  { label: "Le déroulé", href: "/#deroule" },
  { label: "Effets", href: "/#effets" },
  { label: "Musique", href: "/#musique" },
  { label: "FAQ", href: "/#faq" },
  { label: "Contact", href: "/#devis" },
];

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

export const hero = {
  surTitre: "DJ animateur · Val-d'Oise",
  titre: ["MILLENIUM", "DJ"],
  accroche: "Le partenaire de vos réceptions",
  sousTitre:
    "Animation, sonorisation et éclairage pour vos mariages, anniversaires et soirées d'entreprise.",
  ctaPrincipal: { label: "Demander un devis", href: "/#devis" },
  ctaSecondaire: { label: "Préparer ma soirée", href: "/preparer-ma-soiree/" },
};

/* -------------------------------------------------------------------------- */
/* Présentation                                                                */
/* -------------------------------------------------------------------------- */

export const presentation = {
  surTitre: "Derrière les platines",
  titre: "Une soirée, ça se prépare à deux.",
  prenomDJ: "[À COMPLÉTER : prénom du DJ]",
  paragraphes: [
    "Bonjour, je suis [À COMPLÉTER : prénom du DJ], DJ animateur et fondateur de Millenium DJ Animation.",
    "[À COMPLÉTER : votre parcours en 2 ou 3 phrases — comment vous avez commencé, ce que vous aimez dans ce métier.]",
    "Ma façon de travailler est simple : je vous écoute. Votre soirée ne ressemble à aucune autre, alors la musique, le rythme et les moments forts sont construits avec vous, pour vous et vos invités.",
  ],
  methode: [
    {
      titre: "Le rendez-vous de préparation",
      texte:
        "On se rencontre pour parler de vous, de vos invités, de vos envies et de ce que vous ne voulez surtout pas entendre.",
    },
    {
      titre: "Votre fiche personnalisée",
      texte:
        "Déroulé, horaires, chansons clés, annonces, surprises : tout est noté sur une fiche qui me suit jusqu'au jour J.",
    },
    {
      titre: "À l'écoute, jusqu'au bout",
      texte:
        "Pendant la soirée, je lis la piste en direct et j'adapte la musique à l'énergie de la salle, jusqu'à la dernière chanson.",
    },
  ],
  photo: {
    src: "",
    alt: "Portrait du DJ de Millenium DJ Animation derrière ses platines",
    label: "Portrait du DJ",
  } satisfies Photo,
};

/* -------------------------------------------------------------------------- */
/* Prestations                                                                 */
/* -------------------------------------------------------------------------- */

export const prestations: {
  surTitre: string;
  titre: string;
  intro: string;
  liste: Prestation[];
} = {
  surTitre: "Prestations",
  titre: "Chaque réception a sa lumière.",
  intro:
    "Animation, sonorisation et éclairage réunis : un seul interlocuteur pour faire vivre votre événement du premier verre à la dernière danse.",
  liste: [
    {
      id: "mariages",
      titre: "Mariages",
      accroche: "Le plus beau jour, du « oui » à la dernière danse.",
      texte:
        "Cérémonie, cocktail, entrée des mariés, repas rythmé, ouverture du bal et soirée dansante : je vous accompagne à chaque moment de la journée.",
      points: [
        "Rendez-vous de préparation",
        "Fiche de soirée personnalisée",
        "Sonorisation de la cérémonie",
        "Ouverture du bal mise en scène",
      ],
      couleur: "gold",
      photo: { src: "", alt: "Mariage animé par Millenium DJ", label: "Mariage" },
    },
    {
      id: "anniversaires",
      titre: "Anniversaires",
      accroche: "18, 30, 50 ou 80 ans : la fête à votre image.",
      texte:
        "Une playlist qui rassemble toutes les générations, des surprises préparées avec vos proches et une piste qui ne désemplit pas.",
      points: [
        "Musique pour toutes les générations",
        "Annonces et surprises",
        "Diaporama sur écran",
        "Éclairage d'ambiance",
      ],
      couleur: "magenta",
      photo: { src: "", alt: "Anniversaire animé par Millenium DJ", label: "Anniversaire" },
    },
    {
      id: "entreprise",
      titre: "Soirées d'entreprise",
      accroche: "Fédérer vos équipes, marquer vos invités.",
      texte:
        "Séminaires, soirées de fin d'année, lancements : une sonorisation fiable pour les discours et une vraie soirée pour clôturer en beauté.",
      points: [
        "Micros pour les discours",
        "Vidéoprojecteur et écran",
        "Ambiance adaptée à votre image",
        "Soirée dansante",
      ],
      couleur: "cyan",
      photo: { src: "", alt: "Soirée d'entreprise animée par Millenium DJ", label: "Soirée d'entreprise" },
    },
    {
      id: "cocktails",
      titre: "Cocktails & événementiel",
      accroche: "Une ambiance sur mesure, du lounge au dancefloor.",
      texte:
        "Vins d'honneur, inaugurations, réceptions : un fond musical élégant ou un set acoustique, une sonorisation discrète et un éclairage qui habille le lieu.",
      points: [
        "Cocktail acoustique",
        "Sonorisation intérieure ou extérieure",
        "Éclairage d'ambiance de la salle",
        "Installation discrète",
      ],
      couleur: "violet",
      photo: { src: "", alt: "Cocktail animé par Millenium DJ", label: "Cocktail" },
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Le déroulé de votre soirée (timeline)                                      */
/* -------------------------------------------------------------------------- */

export const deroule: {
  surTitre: string;
  titre: string;
  intro: string;
  etapes: EtapeDeroule[];
} = {
  surTitre: "Le déroulé de votre soirée",
  titre: "De la cérémonie à la piste de danse.",
  intro:
    "Un mariage, c'est une histoire en plusieurs actes. Je les anime tous, et je fais monter la lumière au bon moment.",
  etapes: [
    {
      titre: "Cérémonie",
      texte: "Sonorisation de la cérémonie laïque ou en extérieur, micros et musiques choisies pour l'entrée et la sortie.",
    },
    {
      titre: "Cocktail",
      texte: "Un fond musical élégant ou un cocktail acoustique pendant que vos invités trinquent.",
    },
    {
      titre: "Entrée des mariés",
      texte: "La salle s'éteint, votre musique démarre : une entrée mise en scène pour lancer la soirée.",
    },
    {
      titre: "Repas & animations",
      texte: "Un repas rythmé avec, entre les plats, les jeux, les vidéos et les discours de vos proches.",
    },
    {
      titre: "Ouverture du bal",
      texte: "Votre première danse, avec fumée lourde ou étincelles froides si vous le souhaitez.",
    },
    {
      titre: "Gâteau & traditions",
      texte: "Arrivée du gâteau, bouquet, jarretière, tombola et remerciements : chaque tradition a sa musique.",
    },
    {
      titre: "La piste de danse",
      texte: "Toutes les lumières s'allument. On danse jusqu'à la dernière chanson.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Effets & options                                                            */
/* -------------------------------------------------------------------------- */

export const effets: {
  surTitre: string;
  titre: string;
  intro: string;
  indication: string;
  liste: EffetCarte[];
} = {
  surTitre: "Effets & options",
  titre: "Les petits plus qui font les grands souvenirs.",
  intro:
    "Pour les moments forts, ajoutez un effet. Passez la souris (ou touchez) les cartes pour un aperçu.",
  indication: "Survolez · touchez",
  liste: [
    {
      id: "fumee",
      titre: "Fumée lourde",
      texte: "Un nuage blanc au ras du sol pour une ouverture du bal comme sur un nuage.",
      effet: "fumee",
    },
    {
      id: "etincelles",
      titre: "Étincelles froides",
      texte: "Des jets d'étincelles froides pour l'entrée des mariés, le gâteau ou l'ouverture du bal.",
      effet: "etincelles",
    },
    {
      id: "eclairage",
      titre: "Éclairage d'ambiance",
      texte: "La salle prend les couleurs de votre décoration pour une atmosphère unique.",
      effet: "eclairage",
    },
    {
      id: "ceremonie",
      titre: "Sonorisation de la cérémonie",
      texte: "Cérémonie laïque ou en extérieur : chaque mot et chaque musique entendus de tous.",
      effet: "ondes",
    },
    {
      id: "acoustique",
      titre: "Cocktail acoustique",
      texte: "Une ambiance douce et élégante pour accompagner le vin d'honneur.",
      effet: "notes",
    },
    {
      id: "video",
      titre: "Vidéoprojecteur + écran",
      texte: "Diaporama, vidéos surprises, montages de vos proches : sur grand écran.",
      effet: "projecteur",
    },
    {
      id: "micros",
      titre: "Micros pour les discours",
      texte: "Témoins, parents, amis : des micros prêts pour chaque prise de parole.",
      effet: "ondes",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Ambiances musicales                                                         */
/* -------------------------------------------------------------------------- */

export const musique = {
  surTitre: "Ambiances musicales",
  titre: "Toutes les musiques, pour tous vos invités.",
  intro:
    "Des grands classiques aux derniers tubes, je mélange les styles pour que chaque génération trouve sa chanson.",
  styles: [
    "Valse / Musette / Tango",
    "Rock / Twist",
    "Slows",
    "Disco",
    "Années 80",
    "Années 90",
    "Pop / Rock",
    "Funk",
    "Dance / Electro",
    "Groove / R&B",
    "Latino / Reggaeton",
    "Salsa / Bachata",
    "Zouk / Ragga",
    "Orientale",
    "Rap / Urbain",
  ],
};

/* -------------------------------------------------------------------------- */
/* Galerie photos                                                              */
/* -------------------------------------------------------------------------- */

export const galerie: { surTitre: string; titre: string; photos: Photo[] } = {
  surTitre: "En images",
  titre: "L'ambiance, en vrai.",
  photos: [
    { src: "", alt: "Piste de danse pendant une soirée", label: "Piste de danse" },
    { src: "", alt: "Installation sonore et lumières", label: "Installation" },
    { src: "", alt: "Ouverture du bal", label: "Ouverture du bal" },
    { src: "", alt: "Éclairage d'ambiance d'une salle", label: "Éclairage" },
    { src: "", alt: "Les platines du DJ", label: "Platines" },
    { src: "", alt: "Étincelles froides", label: "Étincelles" },
  ],
};

/* -------------------------------------------------------------------------- */
/* Avis clients — UNIQUEMENT DE VRAIS AVIS                                     */
/* -------------------------------------------------------------------------- */

export const avis: { surTitre: string; titre: string; liste: Avis[] } = {
  surTitre: "Ils ont dansé",
  titre: "Ce qu'en disent les invités d'honneur.",
  /*
   * Exemple de format (à recopier avec un vrai avis, puis décommenter) :
   * {
   *   nom: "Prénom N.",
   *   evenement: "Mariage",
   *   date: "Juin 2025",
   *   texte: "Le texte exact de l'avis…",
   *   note: 5,            // facultatif, de 1 à 5
   *   source: "Google",   // facultatif
   * },
   */
  liste: [],
};

/* -------------------------------------------------------------------------- */
/* FAQ                                                                         */
/* -------------------------------------------------------------------------- */

export const faq: { surTitre: string; titre: string; questions: { q: string; r: string }[] } = {
  surTitre: "Questions fréquentes",
  titre: "Tout ce que vous vous demandez.",
  questions: [
    {
      q: "Pour quels événements puis-je faire appel à vous ?",
      r: "Mariages, anniversaires, soirées d'entreprise, cocktails et tout type d'événementiel. L'animation, la sonorisation et l'éclairage sont pris en charge.",
    },
    {
      q: "Dans quelle zone intervenez-vous ?",
      r: "Millenium DJ Animation est basé à Saint-Ouen-l'Aumône, dans le Val-d'Oise. Zone d'intervention : [À COMPLÉTER : zone d'intervention].",
    },
    {
      q: "Comment se passe la préparation de la soirée ?",
      r: "On organise un rendez-vous de préparation pour parler de vos envies, de vos invités et du déroulé. Tout est ensuite noté sur une fiche personnalisée. Vous pouvez aussi remplir le questionnaire « Préparer ma soirée » en ligne.",
    },
    {
      q: "Peut-on choisir la musique ?",
      r: "Bien sûr. Vous indiquez vos styles préférés, les chansons incontournables pour les moments clés et celles à ne surtout pas passer. Pendant la soirée, j'adapte ensuite la musique à la piste.",
    },
    {
      q: "Quels sont vos tarifs ?",
      r: "Chaque soirée est différente (durée, lieu, options), le tarif est donc établi sur devis personnalisé. Décrivez votre événement dans le formulaire et je vous réponds rapidement.",
    },
    {
      q: "Combien de temps à l'avance faut-il réserver ?",
      r: "[À COMPLÉTER : délai de réservation conseillé, conditions d'acompte.]",
    },
    {
      q: "Jusqu'à quelle heure dure l'animation ?",
      r: "[À COMPLÉTER : horaires habituels et conditions pour prolonger la soirée.]",
    },
    {
      q: "Le matériel son et lumière est-il fourni ?",
      r: "Oui, la sonorisation et l'éclairage font partie du métier de Millenium DJ Animation. Les options (fumée lourde, étincelles froides, vidéoprojecteur, micros…) s'ajoutent selon vos envies.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Formulaire de devis                                                         */
/* -------------------------------------------------------------------------- */

export const devis = {
  surTitre: "Demander un devis",
  titre: "Parlons de votre soirée.",
  intro:
    "Quelques infos suffisent pour commencer. Je vous recontacte pour en parler de vive voix.",
  typesEvenement: [
    "Mariage",
    "Anniversaire",
    "Soirée d'entreprise",
    "Cocktail",
    "Autre événement",
  ],
  boutonEnvoi: "Envoyer ma demande",
  mentionRGPD:
    "Vos informations servent uniquement à répondre à votre demande. Elles ne sont ni revendues ni utilisées à d'autres fins.",
  encartQuestionnaire: {
    titre: "Déjà réservé ?",
    texte:
      "Remplissez le questionnaire « Préparer ma soirée » : déroulé, musiques, moments clés. Tout sera prêt pour notre rendez-vous.",
    bouton: "Préparer ma soirée",
  },
};

/* -------------------------------------------------------------------------- */
/* Questionnaire « Préparer ma soirée »                                        */
/* -------------------------------------------------------------------------- */

export const questionnaire = {
  titre: "Préparer ma soirée",
  intro:
    "Prenez le temps de répondre : vos réponses sont gardées sur cet appareil au fur et à mesure. À la fin, vous m'envoyez le tout en un clic.",
  moments: [
    "Cérémonie",
    "Cocktail",
    "Entrée des mariés",
    "Repas",
    "Animations entre les plats (jeux, vidéos, discours)",
    "Ouverture du bal",
    "Gâteau",
    "Bouquet / jarretière / tombola",
    "Remerciements",
    "Soirée dansante",
  ],
  /** Moments pour lesquels on demande une chanson précise. */
  chansonsCles: [
    "Entrée des mariés",
    "Ouverture du bal",
    "Arrivée du gâteau",
    "Dernière chanson de la soirée",
  ],
  niveauxGout: ["Pas du tout", "Un peu", "Beaucoup", "À fond !"],
};

/* -------------------------------------------------------------------------- */
/* Pied de page & mentions légales                                            */
/* -------------------------------------------------------------------------- */

export const piedDePage = {
  texte: "Animation · Sonorisation · Éclairage pour vos réceptions.",
};

export const mentionsLegales = {
  raisonSociale: "[À COMPLÉTER : raison sociale / nom de l'entrepreneur]",
  formeJuridique: "[À COMPLÉTER : forme juridique (micro-entreprise, SARL…)]",
  siret: "[À COMPLÉTER : numéro SIRET]",
  responsablePublication: "[À COMPLÉTER : nom du responsable de la publication]",
  hebergeur:
    "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com",
};
