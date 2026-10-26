# Accès public (wifi du campus et 4G)

Par défaut, l'app tourne sur ta machine et n'est joignable que depuis le même réseau. Pour que tout le monde puisse jouer, y compris en 4G, `pnpm dev:tunnel` lance le serveur de dev derrière un [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), sur **https://campudex.elouann.dev**.

Les avantages par rapport au wifi seul :

- **Une seule adresse pour tout le monde**, quel que soit le réseau. Plus besoin de donner l'IP de ta machine.
- **Un vrai certificat HTTPS** : pas d'alerte de sécurité sur les téléphones, et la caméra (scan des PNJ) marche directement.
- **Une URL fixe** : l'URL de retour du login 42 ne change jamais.

## Mise en place (une seule fois)

### 1. Mettre le domaine sur Cloudflare

Le domaine `elouann.dev` reste acheté chez name.com, seuls ses serveurs DNS passent chez Cloudflare (offre gratuite).

1. Sur le [tableau de bord Cloudflare](https://dash.cloudflare.com/), ajoute le domaine `elouann.dev` et choisis l'offre **Free**.
2. Cloudflare importe les enregistrements DNS existants. **Vérifie qu'il n'en manque aucun**, surtout les `MX` si le domaine reçoit des mails : tout ce qui manque sera coupé après la bascule.
3. Chez name.com, remplace les serveurs DNS du domaine par les deux que Cloudflare t'indique.
4. Attends que Cloudflare affiche le domaine comme **actif**. Ça prend de quelques minutes à quelques heures, et Cloudflare envoie un mail quand c'est bon.

### 2. Créer le tunnel

1. Dans Cloudflare, va dans **Zero Trust → Networks → Tunnels** et crée un tunnel de type **Cloudflared** nommé `campudex`.
2. Cloudflare affiche une commande d'installation contenant `--token <un long texte>`. **Copie seulement ce token**, pas la peine de lancer la commande : `cloudflared` est déjà installé avec les dépendances du projet.

### 3. Brancher l'adresse publique

Dans le tunnel, onglet **Public hostnames**, ajoute :

| Champ | Valeur |
| --- | --- |
| Subdomain | `campudex` |
| Domain | `elouann.dev` |
| Service | `HTTP` → `localhost:3000` |

Cloudflare crée l'enregistrement DNS `campudex.elouann.dev` tout seul.

### 4. Configurer l'app

Dans `.env` (voir `.env.example`) :

```
TUNNEL_HOSTNAME=campudex.elouann.dev
TUNNEL_TOKEN=<le token copié à l'étape 2>
```

Le token donne le contrôle du tunnel : il ne doit jamais être commité (`.env` est ignoré par git).

### 5. Autoriser le retour du login 42

Dans les réglages de l'app 42 (intra → API), ajoute l'URL de redirection :

```
https://campudex.elouann.dev/auth/42
```

## Utilisation

```bash
pnpm db:up        # la base de données
pnpm dev:tunnel   # l'app + le tunnel
```

Quand le terminal affiche `Registered tunnel connection`, le jeu est accessible sur **https://campudex.elouann.dev**. `Ctrl+C` arrête tout.

Ce que fait le script (`scripts/dev-tunnel.mjs`) :

- il lit `.env`, puis lance `nuxt dev` sur le port 3000 et le tunnel en même temps ;
- si l'un des deux s'arrête, il arrête l'autre, pour ne pas laisser un tunnel qui pointe dans le vide ;
- il fait pointer le login 42 vers l'adresse publique : pendant que le tunnel tourne, utilise donc aussi `https://campudex.elouann.dev` sur ta machine, pas `localhost` ;
- il ne change rien au `pnpm dev` normal, qui marche toujours en local.

## Le jour du jeu

- **La machine qui lance `pnpm dev:tunnel` est le serveur du jeu.** Si elle s'éteint, se met en veille ou perd sa connexion, le jeu s'arrête pour tout le monde. Garde-la sur secteur, avec la mise en veille désactivée.
- **Les photos des quêtes sont stockées sur cette machine** (`.data/photos/`), tout comme la base de données (Docker).
- **Le hot reload ne marche pas sur `localhost` pendant que le tunnel tourne**, seulement via l'adresse publique. Ça ne gêne que si tu modifies le code pendant la partie.

## En cas de problème

| Symptôme | Cause probable |
| --- | --- |
| `TUNNEL_HOSTNAME and TUNNEL_TOKEN must be set in .env` | Il manque une des deux variables dans `.env` (étape 4). |
| `Provided Tunnel token is not valid` | Token mal copié ou tunnel supprimé : recopie-le depuis Zero Trust (étape 2). |
| Le site ne répond pas du tout | Le domaine n'est pas encore actif sur Cloudflare (étape 1), ou le *Public hostname* manque (étape 3). |
| `Bad gateway` / erreur 502 | Le tunnel tourne mais n'atteint pas l'app : vérifie que le service est bien `HTTP` → `localhost:3000` (étape 3) et que Nuxt a fini de démarrer. |
| `Blocked request. This host (…) is not allowed` | `TUNNEL_HOSTNAME` ne correspond pas à l'adresse utilisée dans le navigateur. |
| Erreur `redirect_uri` sur la page de login 42 | L'URL de redirection n'est pas autorisée dans l'app 42 (étape 5). |
| Connecté sur l'app mais renvoyé vers la page de login | Tu utilises `localhost` au lieu de `https://campudex.elouann.dev` pendant que le tunnel tourne. |
