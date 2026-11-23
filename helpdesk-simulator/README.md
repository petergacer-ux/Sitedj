# 🖥️🔧 HelpDesk Simulator

Simulation **3D à la première personne**, jouable dans le navigateur : vous êtes technicien
helpdesk / support IT dans une PME. Recevez des tickets, enquêtez au bureau des utilisateurs,
brassez la baie, configurez les switchs en CLI, gérez l'Active Directory… et résolvez les
problèmes **pour de vrai** : le jeu vérifie l'état réel du monde.

> Projet pensé pour les étudiants **BTS SIO option SISR** : les commandes et le vocabulaire sont réalistes.

## 🚀 Lancer le jeu

Prérequis : [Node.js](https://nodejs.org/) 20 ou plus.

```bash
cd helpdesk-simulator
npm install
npm run dev
```

Ouvrez ensuite l'adresse affichée (par défaut <http://localhost:5173>).

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement (rechargement à chaud) |
| `npm test` | tests unitaires (Vitest) |
| `npm run build` | vérification TypeScript + build de production dans `dist/` |
| `npm run preview` | sert le build de production |

## 🎮 Commandes

| Touche | Action |
|---|---|
| **Souris** | regarder autour de soi |
| **Z Q S D** (AZERTY) / **W A S D** (QWERTY) / flèches | se déplacer — les deux dispositions marchent automatiquement |
| **Maj** | marcher plus vite |
| **C** (ou Ctrl gauche) | se baisser (pour voir les prises murales sous les bureaux) |
| **E** | interagir avec l'objet visé (il est surligné et une bulle s'affiche) |
| **M** | plan de l'étage (position, bureaux, tickets ouverts) |
| **H** | afficher / masquer l'aide des touches |
| **Échap** | fermer une fenêtre / quitter une vue rapprochée / menu pause |
| **Molette** | en vue rapprochée de la baie : monter / descendre |
| **1 à 9** | choisir une réponse dans un dialogue |

> ⚠️ Préférez **C** à Ctrl pour se baisser : dans certains navigateurs, Ctrl + W ferme l'onglet !

Au démarrage, cliquez sur **Nouvelle partie** : le navigateur « verrouille » la souris dans le jeu
(Pointer Lock, obligatoire pour la vue à la première personne). **Échap** la libère et ouvre la pause.
Après avoir fermé une fenêtre avec Échap, il faut recliquer dans le jeu (règle de sécurité des navigateurs) ;
le bouton ✕ de la fenêtre, lui, reprend directement.

## 🗺️ L'étage

```
 z=0  ┌────────┬───────┬────┬──────────┬──────┬──────┐   fenêtres
      │Helpdesk│Serveur│Imp.│ Réunion  │Direct│  RH  │
      │ (vous) │ 🔒    │    │          │ B-09 │ B-10 │
 z=10 ├───▯────┴───▯───┴─  ─┴────▯─────┴──▯───┴──▯───┤
      │                    couloir                    │
 z=14 ├─────     ─────┬─B-12─    ───────┬──▯──┬─    ──┤
      │ Open space    │  Open space     │Jurid│Cafét.│
      │ Compta        │  Commercial     │B-11 │  ☕  │
      │ B-01 … B-04   │  B-05 … B-08    │     │      │
 z=24 └───────────────┴─────────────────┴─────┴──────┘   fenêtres
```

- **Helpdesk** : votre PC (HelpDesk Pro), le téléphone, l'étagère de stock.
- **Salle serveur** (badge requis) : baie 19" avec panneau de brassage 24 ports, 2 switchs 24 ports,
  routeur/pare-feu, serveur AD/DNS/DHCP/fichiers, NAS et onduleur.
- **12 postes** utilisateurs, chacun avec sa **prise murale numérotée** (B-01 … B-12), 11 collègues (PNJ).
- Salle de réunion (écran de visio), local copieur, imprimante réseau Compta, cafétéria (le café remonte l'énergie).

## 🧭 Plan de développement

Chaque étape laisse le jeu lançable et jouable.

| # | Étape | État |
|---|---|---|
| 1 | **Base 3D** : étage low poly, contrôles FPS, collisions, portes, raycast + surlignage, HUD, horloge, options, plan, sauvegarde | ✅ |
| 2 | **Moteur réseau + baie** : PC → câble → prise → panneau → cordon → switch, brassage au clic, câbles 3D, LED réelles, tests | ⏳ |
| 3 | **Terminal switch** (CLI style IOS : abréviations, Tab, `?`, VLAN, shutdown, `write memory`), tests | ⏳ |
| 4 | **HelpDesk Pro (GLPI-like)** : tickets, statuts, suivis, SLA, notifications, 5 scénarios réseau de bout en bout | ⏳ |
| 5 | **Poste Windows** (ipconfig, ping, net use, gpupdate…) et **console AD**, scénarios comptes / lecteurs / impression | ⏳ |
| 6 | **Inventaire et outils** (objet en main, testeur de câble, remplacement de pièces, prêt de PC) | ⏳ |
| 7 | **PNJ** (dialogues, visites, téléphone), satisfaction, journées, bilan, progression | ⏳ |
| 8 | **Tutoriel, bac à sable, sons, finitions**, 20+ scénarios | ⏳ |

### Ce qui marche déjà (étape 1)

- Déplacement à la première personne (Pointer Lock), course, accroupissement, balancement de caméra désactivable,
  collisions avec murs, portes et meubles.
- Viseur central, **objets interactifs surlignés** à moins de 2 m, bulle « E — … ».
- Portes animées ; la **salle serveur est verrouillée** : on badge pour entrer.
- Votre PC ouvre **HelpDesk Pro** (caméra qui s'approche en douceur de l'écran) ; les postes utilisateurs
  ouvrent un bureau Windows simulé (contenu complet à l'étape 5).
- **Vue rapprochée de la baie** : molette pour monter/descendre, survol des équipements pour les identifier.
- Écrans du décor dynamiques (verrouillage, bureau, écran noir, erreur, « aucun signal ») — pour voir les pannes de loin.
- PNJ low poly assis à leur bureau, à qui l'on peut parler (E), avec personnalité.
- Horloge de jeu 8 h 30 → 17 h 30 (≈ 10 min réelles), jauge d'énergie + machine à café, bilan de fin de journée.
- Plan de l'étage (M), notifications en haut à droite, sons synthétisés (Web Audio, aucun fichier).
- Options : sensibilité souris, champ de vision, qualité graphique (basse / moyenne / haute), son, FPS.
- Sauvegarde / chargement dans `localStorage` (menu pause) + sauvegarde auto en fin de journée.

## 🏗️ Architecture

```
helpdesk-simulator/
  index.html
  public/assets/models/      ← vos modèles 3D (.glb) + manifest.json
  src/
    main.ts                  point d'entrée
    Game.ts                  chef d'orchestre : modes de jeu, interactions, sauvegarde
    engine/                  Renderer (lumières, qualité), FirstPersonController, InteractionSystem (raycast, surlignage)
    world/                   construction de l'étage, mobilier, portes, PNJ, écrans, collisions, instancing, chargeur GLTF
    network/                 (étape 2) Device, Port, Cable, Switch, Vlan, Dhcp, ping — sans Three.js
    cli/                     (étape 3) parseur IOS, autocomplétion, aide — sans Three.js
    apps/                    overlays HTML : HelpDesk Pro, poste Windows, puis AD, terminal, vue baie
    tickets/                 (étape 4) générateur, vérification de résolution, SLA, satisfaction
    data/                    plan de l'étage, utilisateurs, puis scenarios/ et équipements
    state/                   état global (source de vérité), horloge, options, sauvegarde
    ui/                      HUD, menus, plan, dialogues, notifications
    audio/                   sons synthétisés
```

Principes :

- **Un seul état global** (`state/GameState.ts`) que le HUD, HelpDesk Pro, les terminaux et le plan lisent tous.
- Les modules « métier » (collisions, horloge, puis réseau, CLI, tickets) sont **indépendants de Three.js** et testés avec Vitest.
- **Piloté par les données** : l'étage (`data/map.ts`) et les collègues (`data/users.ts`) se modifient sans toucher au moteur ;
  les scénarios seront de simples fichiers dans `data/scenarios/`.
- **Performance** : tous les objets statiques (murs, pieds de bureau, néons, chaises…) sont regroupés en `InstancedMesh`
  (un draw call par matériau), les PNJ sont fusionnés par couleur, une seule lumière porte des ombres.

### Remplacer les objets par de vrais modèles 3D

1. Déposez un fichier `.glb` dans `public/assets/models/`.
2. Déclarez-le dans `public/assets/models/manifest.json`, par exemple :
   ```json
   { "models": { "coffee": "machine_cafe.glb", "rack": "baie_42u.glb" } }
   ```
3. Rechargez : le modèle est mis à l'échelle de l'objet d'origine, qui reste en place (invisible) pour les interactions.

Clés disponibles : `rack`, `coffee`, `copier`, `shelf`.

## 🧪 Tests

```bash
npm test
```

Étape 1 : collisions (glisser le long d'un mur, ne pas traverser, portes ouvertes) et horloge de jeu.
