# Administration

`/admin` est réservé aux comptes dont le rôle **réel** est `ADMIN` (dont les logins de `NUXT_ADMIN_LOGINS`).

Les logins de `NUXT_ADMIN_LOGINS` sont les **propriétaires** : ils sont toujours en base comme `ADMIN`, recréés au démarrage, à la connexion 42 et à chaque requête si une remise à zéro, un import ou une suppression les a retirés. Aucun patch ne peut les supprimer, les rétrograder ou les mettre dans un groupe.

Chaque admin a **toujours une version joueur et une version PNJ** : il garde son rôle `ADMIN` et passe de l'une à l'autre depuis le sélecteur de vue.

- **Joueur** : son groupe. S'il n'en a pas, il rejoint le groupe « Admins », commun à tous les admins sans groupe et marqué `sandbox` : badge « Admin » dans Groupes, exclu des chiffres de la vue d'ensemble et de l'export. Un admin peut aussi être mis dans un vrai groupe.
- **PNJ** : un profil « PNJ de <login> », à renommer et à remplir de quêtes depuis « PNJ & quêtes ».

Les deux sont créés au démarrage, à la connexion, après chaque patch et à chaque requête s'ils manquent : une remise à zéro, une suppression ou un nouveau rôle admin les recrée tout de suite.

Tout admin peut changer de vue depuis n'importe quelle page grâce au sélecteur du header (pour cette session seulement) :

- **Admin** : le tableau de bord ;
- **Moi** : son propre groupe et son propre PNJ, s'il en a ;
- **Joueur · <groupe>** / **PNJ · <nom>** : n'importe quel groupe ou PNJ ;
- **Incarner un compte** : voit le jeu exactement comme ce compte (son rôle, son groupe, son PNJ). Aussi disponible via le bouton « Incarner » de la page Utilisateurs et dans « se mettre dans la peau de… ».

Pendant une incarnation, le bandeau propose **Gérer ce compte** (page Utilisateurs filtrée sur ce login) et **Redevenir admin**. Les droits d'admin restent ceux de l'admin connecté.

| Page | Rôle |
| --- | --- |
| Vue d'ensemble | Chiffres clés, état de la partie (lancer, pause, revenir en attente), « se mettre dans la peau de… », joueurs à placer, grille de progression modifiable |
| Groupes | Générer des groupes au hasard, placer les joueurs sans groupe, créer, renommer, supprimer (seul ou en masse), gérer les membres, QR codes |
| Utilisateurs | Ajouter des logins en masse, changer rôle et groupe, suppression et actions groupées |
| PNJ & quêtes | Créer et modifier les PNJ (nom, lore) et leurs quêtes, partager une quête existante avec un autre PNJ |
| Import JSON | Éditer, simuler et appliquer un document JSON, exporter les données |
| Maintenance | Réappliquer le pré-remplissage, remises à zéro et suppressions de masse |

L'interface est en **français et en anglais** (sélecteur FR/EN du header, retenu dans un cookie ; par défaut, la langue du navigateur).

## Pré-remplissage (`prefill.json`)

`prefill.json`, à la racine du projet, décrit les données de départ au [format JSON](#format-json) de l'admin : par défaut l'état de la partie et les admins. Remplis-le avant le jour J avec les PNJ volontaires et leurs quêtes :

```json
{
  "game": { "phase": "WAITING", "paused": false, "pauseMessage": null },
  "users": [{ "login": "ehosta", "role": "ADMIN" }],
  "npcs": [
    {
      "login": "dprince",
      "name": "Le Spectre Affamé",
      "lore": "Ancré à la cantine depuis des siècles.",
      "quests": [{ "key": "cantine", "label": "J'ai faim…", "answer": "La cantine", "difficulty": 2 }]
    }
  ]
}
```

- Il est appliqué **tout seul sur une base vide** (au démarrage du serveur, s'il n'y a pas encore d'état de partie) : après un `pnpm db:push`, la base est prête.
- **Maintenance → Réappliquer** le rejoue à la main, par exemple après l'avoir modifié ou après « Tout effacer ». Sa partie `game` est alors ignorée, pour ne pas arrêter une partie en cours. Ce qui existe déjà reprend les valeurs du fichier (nom et lore des PNJ, textes des quêtes) ; le reste n'est pas touché.
- Il est inclus au build : après l'avoir modifié en production, il faut rebuilder.

## Déroulement de la partie

La partie a deux phases, changées depuis la vue d'ensemble (carte « État de la partie ») :

| Phase | Connexion d'un compte 42 inconnu | Joueurs et PNJ |
| --- | --- | --- |
| **En attente** (`WAITING`) | Il rejoint les joueurs **sans groupe** | Voient leur groupe s'ils en ont un, mais ne peuvent rien faire (`423`). Bandeau « la partie n'a pas encore commencé » |
| **En cours** (`RUNNING`) | Il est **bloqué** sur **/attente** jusqu'à ce qu'un admin le place | Jouent normalement (sauf pendant une pause) |

1. **Avant** : les participants se connectent et apparaissent dans « À placer dans un groupe ».
2. **Former les groupes** (page Groupes) :
   - **Générer des groupes** : choisis la taille visée (2 à 8) et, s'il reste des joueurs, « groupes plus petits » (jamais plus que la taille) ou « groupes plus grands » (jamais moins). Les tailles des groupes diffèrent d'au plus un. L'aperçu montre les groupes et leurs noms tirés au sort (adjectif + nom magie / RPG / dev / 42, accordés en français, en anglais si l'interface est en anglais) : remélange, change les noms ou modifie-les à la main, puis crée-les. Les groupes existants ne bougent pas.
   - **À la main** : coche des joueurs, puis place-les dans un groupe existant ou **forme un groupe** (nom aléatoire, modifiable, 🎲 pour en tirer un autre).
3. **Lancer la partie** : les PNJ peuvent donner leurs quêtes.
4. **Retardataires** : ils sont bloqués et apparaissent dans « À placer » avec le badge « Bloqué ». Place-les dans un groupe, forme-en un nouveau avec eux, ou ajoute-les sans groupe.

« Revenir en attente » fait rejoindre aux comptes bloqués les joueurs sans groupe.

## Classement et journal

Tout le monde dans le jeu (joueurs, PNJ, admins) a deux onglets sous le header, en plus de sa page : **Classement** et **Journal**. Ils se mettent à jour tout seuls.

- **Quêtes partagées** : une quête peut être donnée par plusieurs PNJ (« Partager une quête existante » sur la carte d'un PNJ). N'importe lequel d'entre eux peut la donner puis valider la photo ; le joueur voit qui la lui a confiée et les autres PNJ qui peuvent la valider, le Journal indique le PNJ qui a validé.
- **Noms** : un PNJ peut changer son nom depuis sa page d'accueil ; un joueur peut tirer un nouveau nom de groupe au hasard (🎲 sur la page du groupe).
- **Difficulté** : chaque quête a une difficulté de 1 à 5 ★, réglée à la main (carte du PNJ dans « PNJ & quêtes », `difficulty` dans le JSON et dans `prefill.json`). Par défaut : 1.
- **Points** (`shared/utils/scoring.ts`) : une quête validée rapporte **100 points par niveau de difficulté**, plus un bonus selon l'ordre de validation (date de validation) : **+50 %** pour le premier groupe, +40 % pour le deuxième, … +10 % pour le cinquième, plus rien ensuite. Exemple : une quête ★★★ rapporte 450 points au premier groupe, 420 au deuxième, 300 à partir du sixième.
- **Classement** : par points ; à égalité, le groupe arrivé là en premier passe devant. Le groupe « Admins » ne prend jamais la place d'un vrai groupe : il n'apparaît qu'aux admins, marqué « test », avec le rang qu'il aurait (pareil dans le Journal).
- **Journal** : chaque validation, la plus récente en haut, avec le groupe, le PNJ, la difficulté, le rang (« Premier ! ») et les points gagnés. L'énigme n'est pas affichée, pour ne pas aider les autres groupes.
- Tout est calculé à la volée : changer un statut ou une difficulté depuis l'admin met le classement à jour. Réappliquer le même statut garde la date d'origine, mais un export réimporté dans une base vide date toutes les validations du moment de l'import.

## Fin du Campudex

Sur la page du groupe :

- quand le groupe a **validé toutes les quêtes du jeu**, les âmes de Faurtitou annoncent que la mobilité est rétablie et qu'il faut maintenant rétablir l'ordre et arrêter Sir Claudius ;
- quand il n'a **plus de quête en cours** mais qu'il en reste qu'aucun PNJ ne lui a données, Sir Claudius l'envoie trouver d'autres citoyens de Faurtitou.

## Pause

La pause ne concerne que la phase « en cours ». En pause, les PNJ ne peuvent plus scanner (ni donner, ni valider) et les joueurs ne peuvent plus envoyer de photo (`423`). Tout le monde voit un bandeau avec le message choisi. Un admin qui se met dans la peau d'un joueur ou d'un PNJ n'est pas bloqué, pour pouvoir tester pendant la pause. Avant le lancement, en revanche, personne ne peut scanner ni envoyer de photo, même un admin incarné ; l'accueil des PNJ et la page de scan affichent que la partie n'a pas commencé.

## Format JSON

Toutes les modifications de l'admin, y compris les boutons des pages, passent par un même document, un peu comme le corps d'une énorme requête `PATCH` :

- chaque élément est retrouvé par une clé lisible : le **login** pour un utilisateur ou un PNJ, le **nom** pour un groupe, la **clé** pour une quête ;
- s'il n'existe pas, il est créé ; sinon **seuls les champs indiqués changent** ;
- `"$delete": true` (seul à côté de la clé) le supprime ;
- le document est appliqué **en une seule transaction** : s'il y a la moindre erreur, rien n'est modifié ;
- un même document peut être appliqué deux fois sans rien dupliquer (un renommage déjà fait est reconnu).

```jsonc
{
  // Vide d'abord des collections entières. Les admins ne sont jamais touchés.
  "wipe": ["progress", "quests", "npcs", "teams", "players"],

  // game : phase (WAITING ou RUNNING ; revenir à WAITING fait entrer les
  // comptes bloqués comme joueurs sans groupe), paused, pauseMessage
  "game": { "phase": "RUNNING", "paused": false, "pauseMessage": null },

  "teams": [
    // members : ces logins sont mis dans le groupe (créés comme joueurs s'ils
    // n'existent pas). Les autres membres restent.
    { "name": "Les Raclettes", "members": ["jdoe", "asmith", "bwayne"] },
    { "name": "Ancien nom", "rename": "Nouveau nom" },
    { "name": "Les Fuités", "newQrCode": true },
    { "name": "Groupe en trop", "$delete": true }
  ],

  "users": [
    // role : PLAYER, NPC ou ADMIN. team : nom d'un groupe, ou null pour l'en retirer.
    { "login": "ckent", "role": "PLAYER", "team": "Les Raclettes" },
    { "login": "pparker", "team": null },
    { "login": "parti", "$delete": true }
  ],

  "npcs": [
    {
      "login": "dprince", // le bénévole qui joue ce PNJ
      "name": "Sir Claudius",
      "lore": "Apprenti mage, auteur du maléfice.",
      // Une quête listée sous un PNJ lui est donnée en plus de ses autres PNJ.
      // $delete la retire seulement à ce PNJ.
      "quests": [
        { "key": "cantine", "label": "J'ai faim…", "answer": "La cantine", "difficulty": 2 }
      ]
    },
    // La même quête sous un deuxième PNJ : elle est partagée entre eux.
    { "login": "bwayne", "name": "Dame Brume", "quests": [{ "key": "cantine" }] }
  ],

  // Les quêtes peuvent aussi être listées à part : npcs remplace la liste des
  // PNJ qui la donnent (un ou plusieurs).
  "quests": [
    { "key": "cafe", "npcs": ["dprince", "bwayne"], "label": "…", "answer": "Les machines à café" },
    { "key": "cantine", "rename": "cantine-afk" },
    { "key": "vieille-quete", "$delete": true }
  ],

  // status : HIDDEN (remet à zéro, supprime la photo), GIVEN, SUBMITTED,
  // VALIDATED ou REJECTED.
  "progress": [
    { "team": "Les Raclettes", "quest": "cantine", "status": "GIVEN" }
  ]
}
```

Le vrai fichier ne peut pas contenir de commentaires : ils ne sont là que pour l'explication.

### Ordre d'application

`wipe` → `game` → `teams` → `users` → membres des `teams` → `npcs` (et leurs quêtes) → `quests` → `progress`. Un élément peut donc utiliser ce qu'une section précédente a créé (un utilisateur peut rejoindre un groupe créé dans le même document).

### Règles

| Cas | Effet |
| --- | --- |
| Utilisateur passé `NPC` | Il quitte son groupe |
| `team` sur un PNJ | Erreur (joueurs et admins peuvent avoir un groupe) |
| Nouveau PNJ sans `name` | Erreur |
| PNJ sur un compte joueur | Le compte devient `NPC` et quitte son groupe |
| PNJ sur un compte admin | Le compte reste `ADMIN` (et garde son groupe), avec en plus un profil PNJ |
| `npcs` avec `$delete` | Supprime le profil PNJ et ses quêtes non partagées, le compte redevient joueur sans groupe (un admin reste admin et récupère un PNJ vierge) |
| Quête qui n'a plus aucun PNJ à la fin du patch | Supprimée, avec sa progression |
| Admin sans groupe ou sans PNJ à la fin du patch | Il rejoint le groupe « Admins » et son PNJ est (re)créé |
| Supprimer ou rétrograder un propriétaire (`NUXT_ADMIN_LOGINS`) | Erreur |
| Nouvelle quête sans PNJ, `label` ou `answer` | Erreur |
| Supprimer un groupe, une quête ou un PNJ | Supprime aussi la progression et les photos liées |
| Se supprimer soi-même, ou retirer son propre rôle admin | Erreur |
| Clé de quête | Minuscules, chiffres, `-` et `_` (ex. `cantine`, `afk-2`). Elle n'existe que dans le JSON : une quête créée depuis l'admin reçoit une clé tirée de son énigme (`cantine`, `cantine-2`…), jamais affichée |

### Exporter, modifier, réimporter

**Import JSON → Charger les données actuelles** remplit l'éditeur avec l'état actuel, au même format. Appliqué sur une base vide, ce document la recrée. Pratique pour modifier beaucoup de choses d'un coup, ou pour sauvegarder avant une opération risquée (**Télécharger un export**).

**Simuler** applique le document puis annule tout, et affiche ce qui aurait changé.

## API

| Route | Description |
| --- | --- |
| `GET /api/admin/state` | Tout ce qu'affichent les pages admin |
| `POST /api/admin/patch` (`?dryRun=1`) | Applique un document (`400` avec `data.issues` : `[{ path, code, params }]`, traduits par l'interface : `patch.<code>` dans `app/i18n`) |
| `POST /api/admin/prefill` | Réapplique `prefill.json`, sans sa partie `game` |
| `GET /api/admin/export` | Les données actuelles, au format du document |
| `POST /api/admin/act-as` `{ role, teamId?, npcId?, userId? }` | Jouer un joueur d'un groupe (`PLAYER`), un PNJ (`NPC`), incarner un compte (`USER`), ou redevenir admin (`ADMIN`) |
| `GET /api/admin/views` | Ce que propose le sélecteur de vue : groupe et PNJ de l'admin, groupes, PNJ, comptes |
| `GET /api/game` | `{ phase, paused, pauseMessage }`, pour tout le monde |
| `GET /api/leaderboard` | Classement (`questCount`, groupes avec `rank`, `points`, `validated`, `mine`), pour tout le monde dans le jeu |
| `GET /api/logs` | Validations, les plus récentes d'abord (300 max), pour tout le monde dans le jeu |

Le format est validé par `shared/utils/admin-patch.ts`, utilisé aussi par l'éditeur pour signaler les erreurs pendant la frappe, et appliqué par `server/utils/admin-patch.ts`.
