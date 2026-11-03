# Millenium DJ Animation — site internet

Site vitrine one-page de **Millenium DJ Animation** (« Le partenaire de vos réceptions ») + questionnaire « Préparer ma soirée ».

Next.js (App Router, export statique) · TypeScript · Tailwind CSS 4 · Framer Motion · GSAP + ScrollTrigger · Lenis · Canvas 2D.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # génère le site statique dans /out
```

## Modifier le contenu

**Tout se passe dans `src/content/site.ts`** : textes, prestations, déroulé, effets & options, styles musicaux, FAQ, avis, photos, coordonnées, mentions légales. Aucun composant à toucher.

- **Photos** : déposez les fichiers dans `public/photos/`, puis renseignez `src: "/photos/mon-fichier.jpg"`. Tant que `src` est vide, un emplacement animé « Photo à venir » s'affiche.
- **Avis clients** : ajoutez uniquement de **vrais** avis dans `avis.liste` (format en commentaire). La section reste masquée tant que la liste est vide.
- **Logo** : mettez le fichier dans `public/` et renseignez `entreprise.logo` (ex. `"/logo.svg"`). Sinon, un logo typographique est utilisé.
- **Réseaux sociaux** : `entreprise.reseaux` (uniquement les comptes qui existent).

## Recevoir les formulaires

Le site est statique (pas de serveur). Deux options :

1. **Recommandé** : créer un formulaire gratuit sur un service comme Formspree, puis coller son adresse dans `formulaires.endpoint` (ex. `https://formspree.io/f/xxxxxx`). Les demandes arrivent par e-mail sur dj2g@orange.fr.
2. **Par défaut** (endpoint vide) : le bouton ouvre la messagerie du visiteur avec un e-mail pré-rempli adressé à dj2g@orange.fr. Le questionnaire propose aussi de télécharger un récapitulatif.

Le questionnaire « Préparer ma soirée » enregistre les réponses dans le navigateur du visiteur (localStorage) pour qu'il puisse y revenir.

## Informations `[À COMPLÉTER]`

Elles s'affichent sur le site en pointillés dorés tant qu'elles ne sont pas remplies. Toutes sont dans `src/content/site.ts` :

| Où | Champ | Information attendue |
|---|---|---|
| `entreprise.zoneIntervention` | Coordonnées / FAQ | Zone d'intervention (villes, départements, distance) |
| `entreprise.urlSite` | SEO | Adresse définitive du site (nom de domaine) |
| `entreprise.logo` | En-tête | Fichier du logo actuel (bleu marine / doré / magenta) |
| `entreprise.reseaux` | Pied de page | Facebook, Instagram… s'ils existent |
| `presentation.prenomDJ` + `paragraphes[0]` | Présentation | Prénom du DJ |
| `presentation.paragraphes[1]` | Présentation | Parcours du DJ en 2-3 phrases |
| `presentation.photo` | Présentation | Portrait du DJ |
| `prestations.liste[].photo` | Prestations | Une photo par prestation (4) |
| `galerie.photos` | Galerie | 6 photos réelles de soirées |
| `avis.liste` | Avis | Vrais avis clients (section masquée sinon) |
| `faq` « Combien de temps à l'avance… » | FAQ | Délai de réservation conseillé, acompte |
| `faq` « Jusqu'à quelle heure… » | FAQ | Horaires habituels, conditions de prolongation |
| `formulaires.endpoint` | Formulaires | Adresse Formspree (ou équivalent) |
| `mentionsLegales.raisonSociale` | Mentions légales | Raison sociale / nom de l'entrepreneur |
| `mentionsLegales.formeJuridique` | Mentions légales | Micro-entreprise, SARL… |
| `mentionsLegales.siret` | Mentions légales | Numéro SIRET |
| `mentionsLegales.responsablePublication` | Mentions légales | Responsable de la publication |

Aucun chiffre, prix, date de création, avis ou nom de client n'a été inventé.

## Déployer sur Vercel (gratuit)

1. Pousser le dépôt sur GitHub.
2. Sur vercel.com : *Add New → Project*, importer le dépôt. Vercel détecte Next.js, rien à configurer.
3. Ajouter le nom de domaine dans *Settings → Domains*, puis le reporter dans `entreprise.urlSite`.

## Architecture

```
src/
  content/site.ts        ← TOUT le contenu éditable
  content/types.ts       ← types du contenu
  styles/tokens.ts       ← design tokens (couleurs, rayons, espacements, glows, easing)
  app/globals.css        ← expose les tokens à Tailwind + grain, animations CSS
  app/                   ← pages : accueil, /preparer-ma-soiree, /mentions-legales
  components/sections/   ← sections de la page d'accueil
  components/fx/         ← effets : faisceaux (canvas), égaliseur, vinyle, fumée/étincelles
  components/ui/         ← boutons magnétiques, révélations en masque, champs, photos
  lib/                   ← boucle canvas, scroll partagé, envoi de formulaire, SEO
```

**Mouvement & performance**
- Les tokens de `styles/tokens.ts` sont la source unique : injectés en variables CSS, utilisés par Tailwind et lus par les canvas.
- Les canvas se mettent en pause hors écran et quand l'onglet est caché, avec une densité de pixels plafonnée.
- `prefers-reduced-motion` : les canvas affichent une image fixe, le scroll horizontal devient une pile verticale, la timeline est entièrement allumée, les bandeaux sont statiques, pas de Lenis ni de curseur personnalisé.
- Curseur halo et boutons magnétiques : souris uniquement.
