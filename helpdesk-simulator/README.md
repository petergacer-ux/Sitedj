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

| # | Étape | État |
|---|---|---|
| 1 | Base 3D : étage, contrôles FPS, collisions, portes, raycast + surlignage, HUD, options, plan, sauvegarde | ✅ |
| 2 | Moteur réseau + baie : câblage physique, brassage au clic, câbles 3D, LED réelles | ✅ |
| 3 | Terminal switch (CLI Cisco IOS : abréviations, Tab, `?`, VLAN, trunk, shutdown, port-security, `write memory`, `reload`) | ✅ |
| 4 | HelpDesk Pro (GLPI-like) : tickets, statuts, suivis, SLA, notifications, résolution vérifiée | ✅ |
| 5 | Poste Windows (invite de commandes, réseau, Explorateur, Outlook, imprimantes, périphériques) + console AD | ✅ |
| 6 | Inventaire et outils : objet en main, testeur de câble, câbles, toner, RAM, écran, HDMI, prêt de portable | ✅ |
| 7 | PNJ (dialogues, visites, téléphone), satisfaction, journées, bilan, progression | ✅ |
| 8 | Tutoriel, bac à sable, sons, évènements, **28 scénarios**, README | ✅ |

## 🕹️ Comment se joue une journée

1. **Les demandes arrivent** de 8 h 45 à 16 h 50 : notification HelpDesk Pro, **téléphone qui sonne** sur votre bureau
   (décrochez avant le répondeur !), ou **utilisateur qui vient vous voir** au helpdesk.
2. **HelpDesk Pro** (votre PC) : prenez en charge, prévenez l’utilisateur (suivi), mettez en attente, escaladez au N2…
   Le **SLA** dépend de la priorité (Très haute 1 h, Haute 2 h, Moyenne 4 h, Basse 8 h).
3. **Enquêtez** : parlez à l’utilisateur (description, ce qu’il a fait avant), regardez son écran, ses LED,
   lancez `ipconfig`, `ping`, `net use`… sur son poste, survolez les ports de la baie, `show vlan brief` sur le switch.
4. **Réparez pour de vrai** : câble, brassage, CLI du switch, AD, paramètres Windows, Outlook, imprimante, matériel.
5. **Résolvez le ticket** : le jeu vérifie l’état réel du monde. Si rien n’est réglé, l’utilisateur **rouvre** le ticket.
6. **Bilan** à 17 h 30 : tickets, SLA, satisfaction, XP, remarque du chef. Sauvegarde automatique.

Progression : **Stagiaire → Technicien N1 (300 XP) → Technicien N2 (900 XP) → Admin réseau (2000 XP)** ;
chaque grade débloque des pannes plus complexes. Énergie : le café la remonte. Évènement : **coupure de courant**
(et un switch qui redémarre avec sa config non sauvegardée…).

### Outils à votre disposition

| Où | Quoi |
|---|---|
| **Votre PC** (HelpDesk Pro) | Tickets · **Annuaire AD** (déverrouiller, réinitialiser un mot de passe, activer/désactiver, groupes, créer un compte) · Parc (IP, VLAN, configs non sauvegardées) · **Prêts** (fiche de prêt) · **Terminal SSH** vers les switchs · Base de connaissances + mémo de commandes · Statistiques |
| **Baie** (salle serveur) | Brassage au clic, cordons (couleur, longueur, stock), **console** de SW-01 / SW-02 (bouton ou clic sur la façade du switch) |
| **Poste utilisateur** | Connexion (compte verrouillé, changement de mot de passe), **invite de commandes**, paramètres réseau (carte, DHCP / IP fixe), Explorateur (lecteurs réseau), Outlook (profil, quota, boîte partagée, phishing), imprimantes (file d’attente, par défaut, page de test), gestionnaire de périphériques, redémarrer / fermer la session |
| **Sous les bureaux** (C) | Prise murale : brancher / débrancher, **tester** le câble, le **remplacer** |
| **Arrière de l’unité centrale** | Câble HDMI, redémarrage, ouverture du boîtier (tournevis), ajout de RAM |
| **Étagère / I** | Stock : câbles RJ45, cordons, testeur, tournevis, RAM, écran, HDMI, toner, portable de prêt… (réassort tous les 3 jours). L’objet sélectionné (1-9, molette) apparaît dans votre main ; visez un équipement et appuyez sur E pour l’utiliser. |

### Commandes du switch reconnues

`enable`, `disable`, `configure terminal`, `interface fa0/x` / `gi0/x`, `interface range fa0/1 - 8, fa0/10`,
`interface vlan 99` + `ip address`, `switchport mode access|trunk`, `switchport access vlan N`,
`switchport trunk allowed vlan [add|remove|all|none] …`, `switchport trunk native vlan N`,
`switchport port-security [maximum N | violation …]`, `spanning-tree portfast`, `spanning-tree bpduguard enable`,
`shutdown` / `no shutdown`, `description …`, `vlan N` + `name …`, `no vlan N`, `hostname …`, `ip default-gateway …`,
`do …`, `exit`, `end`, Ctrl+Z, `show vlan [brief]`, `show interfaces status|trunk|fa0/x`, `show ip interface brief`,
`show mac address-table`, `show running-config [interface …]`, `show startup-config`, `show version`, `show history`,
`ping`, `copy running-config startup-config`, `write memory`, `reload`.
Abréviations (`conf t`, `int fa0/5`, `sh vlan br`, `no shut`, `wr`), **Tab**, **?**, ↑/↓, et vrais messages d’erreur IOS.

### Les 28 scénarios

| Grade | Scénarios |
|---|---|
| Stagiaire | câble débranché · écran simplement éteint (faux ticket) · écran noir « aucun signal » (HDMI ou écran HS) · compte verrouillé + mot de passe oublié · file d’impression bloquée · toner vide · lecteur S: disparu · profil Outlook corrompu · boîte aux lettres pleine |
| Technicien N1 | mauvais VLAN · port en shutdown · APIPA (VLAN 1) · groupe AD manquant (+ réouverture de session) · carte réseau désactivée · IP statique erronée · câble défectueux (testeur) · déménagement : prise non brassée · **phishing** (quiz des indices, bloquer, et si quelqu’un clique : réinitialiser le mot de passe) · boîte partagée (groupe AD + Outlook) · poste lent (RAM) · prêt de portable · directeur pressé (priorité très haute, imprimante par défaut) |
| Technicien N2 | imprimante dans le mauvais VLAN · **boucle réseau** (mini-switch sur deux prises) · **config perdue après redémarrage** (plusieurs tickets, `write memory` obligatoire) · VPN en télétravail (téléphone, groupe GG_VPN) · **nouvel arrivant** (compte AD, brassage, VLAN, poste, session) |
| Admin réseau | VLAN retirée des VLAN autorisées sur le trunk |

**Ajouter un scénario** : créer un fichier `src/data/scenarios/NN-mon-scenario.ts` qui exporte
`defineScenario({ ... })` (textes, catégorie, priorité, `inject` qui provoque la panne, `isResolved` qui vérifie
la réparation, dialogues, indices, solution, XP, et `solve` pour le test automatique). Il est chargé automatiquement
et testé par `npm test`.

### Modes

- **Tutoriel** au lancement d’une nouvelle partie : Bernard, votre chef, vous guide sur un premier ticket.
- **Bac à sable** (écran d’accueil) : pas de chrono ni de tickets automatiques, toutes les portes ouvertes ;
  déclenchez n’importe quelle panne dans HelpDesk Pro → « Créer une panne ».

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
    network/                 moteur réseau : câbles, switchs, VLAN, DHCP, boucles, ping, table MAC — sans Three.js
    cli/                     interpréteur Cisco IOS (arbre de commandes, abréviations, Tab, ?) — sans Three.js
    sim/                     Active Directory, postes Windows, invite de commandes, imprimantes, stock — sans Three.js
    tickets/                 tickets : création, SLA, satisfaction, résolution vérifiée — sans Three.js
    apps/                    overlays HTML : HelpDesk Pro, console AD, poste Windows, terminaux, baie, stock
    game/                    tutoriel
    data/                    plan, utilisateurs, baie, scenarios/ (un fichier par scénario)
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

**124 tests** Vitest :

- **chaque scénario** (28) : la panne est injectée, le ticket ne peut pas être résolu sans intervention
  (l’utilisateur le rouvre), puis la solution du technicien est appliquée et reconnue ;
- **CLI IOS** : modes et invites, abréviations, erreurs `^`, `Incomplete`, `Ambiguous`, création auto de VLAN,
  shutdown/no shutdown et messages LINK/LINEPROTO, trunk allowed, err-disable, port-security, `show …`,
  `?`, Tab, perte de config au `reload` sans `write memory`, `copy run start`, `wr` ;
- **réseau** : chemin physique, débrancher, prise non brassée, câble défectueux, carte désactivée, DHCP par VLAN,
  APIPA, VLAN inexistante, trunk coupé, VLAN interdite, ping (passerelle, inter-VLAN, Internet, mauvaise passerelle,
  depuis un switch), table MAC, **boucle** avec un mini-switch, sauvegarde ;
- **AD / Windows** : création de compte, stratégie de mot de passe, verrouillage, partages et **jeton de session**,
  `gpupdate`, `net use` (erreurs 5, 53, 85), `ipconfig` (/all, /release, /renew, APIPA, média déconnecté), `ping`
  par nom, `nslookup`, `net user /domain`, `systeminfo`, impression, stock ;
- **tickets** : SLA, satisfaction, clôture, panne générale multi-tickets, escalade ;
- collisions et horloge.
