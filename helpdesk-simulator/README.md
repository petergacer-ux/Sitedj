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
| `npm run build:single` | version en **un seul fichier HTML** (`dist-single/helpdesk-simulator.html`), à héberger n'importe où |

## 🎮 Commandes

| Touche | Action |
|---|---|
| **Souris** | regarder autour de soi |
| **Z Q S D** (AZERTY) / **W A S D** (QWERTY) / flèches | se déplacer — les deux dispositions marchent automatiquement |
| **Maj** | marcher plus vite |
| **C** (ou Ctrl gauche) | se baisser (pour voir les prises murales sous les bureaux) |
| **E** ou **clic gauche** | interagir avec l'objet visé (il est surligné et une bulle s'affiche) |
| **M** | plan de l'étage (position, bureaux, tickets ouverts) |
| **H** | afficher / masquer l'aide des touches |
| **Échap** | fermer une fenêtre / quitter une vue rapprochée / menu pause |
| **P** | pause (pratique sur les claviers sans Échap) |
| **Molette** | en vue rapprochée de la baie : monter / descendre |
| **1 à 9** | choisir une réponse dans un dialogue |

### Sur iPad / tablette 📱

Le jeu détecte l'écran tactile et affiche des commandes adaptées (pas besoin de souris) :

| Geste / bouton | Action |
|---|---|
| **Moitié gauche** : poser le doigt et glisser | joystick de déplacement (pousser à fond = courir) |
| **Moitié droite** : glisser | regarder autour de soi |
| **Bouton bleu** | interagir avec l'objet visé (le bouton affiche l'action, ex. « Ouvrir la porte ») |
| **⬇ Se baisser** · **🗺️ Plan** · **❚❚ Pause** | comme C, M et Échap |
| **✕** des fenêtres | fermer et reprendre |
| Vue baie : glisser verticalement | monter / descendre ; toucher un équipement pour l'identifier |

**iPad avec clavier + trackpad (Magic Keyboard…)** : touchez « Nouvelle partie » *avec le trackpad*.
Le pointeur est alors verrouillé et on joue comme sur ordinateur : trackpad pour regarder, ZQSD pour marcher,
**E** ou clic pour interagir, **P** pour la pause (les claviers d'iPad n'ont souvent pas de touche Échap ; le ✕ ferme les fenêtres).
Si le navigateur refuse le verrouillage, le jeu bascule tout seul en « cliquer-glisser pour regarder ».

Comme `npm` ne tourne pas sur iPad,
jouez à la version hébergée (voir `npm run build:single`) plutôt qu'avec `npm run dev`.

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
| 2 | **Moteur réseau + baie** : PC → câble → prise → panneau → cordon → switch, brassage au clic, câbles 3D, LED réelles, tests | ✅ |
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

### Ce qui marche en plus (étape 2)

- **Moteur réseau réel** (`src/network/`) : câblage physique, VLAN access/trunk, DHCP relayé par le routeur, APIPA,
  ping avec passerelle et routage inter-VLAN, table MAC, config courante / config de démarrage.
- **Baie interactive** : 1 panneau de brassage 24 ports, 2 switchs (Fa0/1-24 + Gi0/1-2), routeur, serveur.
  - Survol d'un port : « PP-01 port 12 → prise B-12 · non brassé », « SW-01 Fa0/5 · VLAN 10 · connecté → PC-COM-01 ».
  - **Poser un cordon** : choisir la couleur et la longueur dans la barre du bas, cliquer un port libre puis un second port.
    Un cordon trop court est refusé.
  - **Débrancher** : clic droit sur un cordon ou un port occupé (au doigt : toucher le port puis « Débrancher »).
  - **LED réelles** : vert = lien, clignotement = activité, orange = problème, éteint = rien.
- **Sous les bureaux** : se baisser (C) et viser la prise ou le câble → **E** pour débrancher / rebrancher le câble du PC.
- **Écrans** : un poste sans réseau affiche une bulle « Câble réseau débranché » ou « Pas d'accès Internet » (APIPA).
- Sur un poste utilisateur, la fenêtre Windows affiche l'état de la carte Ethernet (IP, masque, passerelle, DNS, MAC).
- Le réseau est sauvegardé avec la partie.

**Exercice pour tester** : le bureau **B-12** (open space Commercial, près du couloir) est un poste neuf, **éteint**,
dont la prise n'est **pas brassée**. Allumez-le (E sur le PC) : pas de réseau. Allez en salle serveur, ouvrez la baie,
reliez **PP-01 port 12** à un port libre de **SW-01 en VLAN 10** (Fa0/12 à Fa0/16 : survolez pour vérifier),
puis revenez : le poste a une adresse en 192.168.10.x.

#### Plan d'adressage

| VLAN | Nom | Réseau | Passerelle (RT-FW-01) | Ports |
|---|---|---|---|---|
| 10 | UTILISATEURS | 192.168.10.0/24 | 192.168.10.254 | SW-01 Fa0/5-16 |
| 20 | COMPTA | 192.168.20.0/24 | 192.168.20.254 | SW-01 Fa0/1-4, 17-20 |
| 30 | IMPRIMANTES | 192.168.30.0/24 | 192.168.30.254 | SW-02 Fa0/2-8 |
| 99 | ADMINISTRATION | 192.168.99.0/24 | 192.168.99.254 | SW-02 Fa0/1, 9-20, 24 |

Serveur SRV-01 (AD/DNS/DHCP) : 192.168.99.10 · SW-01 : 192.168.99.2 · SW-02 : 192.168.99.3 · imprimante IMP-COMPTA : 192.168.30.10.
Trunks : RT-FW-01 Gi0/0 ↔ SW-01 Gi0/1, SW-01 Gi0/2 ↔ SW-02 Gi0/1.

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
    network/                 moteur réseau : câbles, switchs, VLAN, DHCP, ping, table MAC — sans Three.js
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

Clés disponibles : `coffee`, `copier`, `shelf`.

## 🧪 Tests

```bash
npm test
```

- collisions (glisser le long d'un mur, ne pas traverser, portes ouvertes) et horloge de jeu ;
- réseau : chemin physique PC → prise → panneau → switch, débrancher / rebrancher, prise non brassée, câble défectueux,
  carte désactivée, DHCP par VLAN, shutdown, APIPA, VLAN inexistante ou erronée, trunk coupé, VLAN interdite sur le trunk,
  ping (passerelle, inter-VLAN, IP inexistante, mauvaise passerelle, depuis un switch), table MAC,
  perte de config au redémarrage sans `write memory`, longueur des cordons.
