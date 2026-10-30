# Mise en production (serveur perso)

Ce guide met le jeu en ligne sur **ton propre serveur**, qui a déjà un nom de domaine et un certificat SSL. Exemple utilisé partout : `campudex.elouann.dev`, à remplacer par le tien.

## Faut-il garder le tunnel Cloudflare ?

**Non, pas en production.** Le tunnel ([TUNNEL.md](TUNNEL.md)) sert à exposer une machine qui n'est **pas joignable depuis Internet** (ton PC derrière le wifi du campus ou une box), sans ouvrir de port. Ton serveur a déjà une IP publique, un domaine et un certificat : le tunnel n'y apporterait qu'un intermédiaire de plus (latence, une panne possible en plus, un token à protéger).

| | `pnpm dev:tunnel` (ton PC) | Serveur perso (ce guide) |
| --- | --- | --- |
| Joignable sans ouvrir de port | ✅ | inutile, le serveur l'est déjà |
| HTTPS | certificat Cloudflare | **ton certificat**, via nginx |
| Le jeu tient si ton PC s'éteint | ❌ | ✅ |
| Hot reload pour coder | ✅ | ❌ (build de prod) |
| Mode | `nuxt dev` (lent, pas fait pour 200 téléphones) | build optimisé |

Garde le tunnel pour **tester depuis ton PC** avant le jour J. En prod, il ne faut **pas** le lancer.

> ⚠️ **Si `campudex.elouann.dev` pointe aujourd'hui vers le tunnel** (enregistrement `CNAME` vers `…cfargotunnel.com` créé par Cloudflare), il faut le remplacer par un enregistrement **`A`** (et `AAAA` si IPv6) vers l'IP de ton serveur, et supprimer le *Public hostname* du tunnel. Sinon les requêtes continuent d'aller vers ton PC. Tu peux laisser le nuage orange (proxy Cloudflare) : il gère les WebSockets. Dans ce cas, mets **SSL/TLS → Full (strict)** dans Cloudflare.

> 🚀 **Raccourci :** une fois le serveur prêt (étape 1), le `.env` rempli (étape 2) et le certificat en place, `sudo bash scripts/deploy.sh` depuis le clone fait les étapes 3, 5 et 6 : build, service systemd, site nginx (copiés depuis `deploy/`). Le domaine vient de `NUXT_OAUTH2_REDIRECT_URL`. Pour une mise à jour : `sudo bash scripts/deploy.sh --pull`. Le script ajoute l'utilisateur de l'app au groupe `docker` si la base est locale. Certificat hors certbot : renseigne `SSL_CERT` et `SSL_KEY` dans `.env`.

## Vue d'ensemble

```
Téléphones ──HTTPS / WSS (443)──▶ nginx ──HTTP (127.0.0.1:3000)──▶ Nuxt (Node) ──▶ PostgreSQL (Docker, 127.0.0.1:5432)
                                  │                                   │
                          ton certificat SSL                  photos : <dossier de l'app>/.data/photos
```

- **nginx** termine le HTTPS avec ton certificat et transmet tout à l'app, **WebSockets compris** (`/_ws`, le temps réel).
- **L'app** n'écoute que sur `127.0.0.1` : elle n'est jamais joignable sans passer par HTTPS.
- **Une seule instance** de l'app : le temps réel (qui est connecté, à quoi) est en mémoire. Pas de mode cluster (PM2 `-i max`, plusieurs conteneurs…) : les téléphones connectés à une instance ne recevraient pas les événements de l'autre. Une instance tient largement quelques centaines de joueurs.

## Pourquoi le HTTPS est indispensable (QR codes, photos)

Tout fonctionne sans configuration particulière **tant que le site est servi en HTTPS, sur son domaine** :

| Fonction | Ce qui exige le HTTPS | Ce qu'il se passe en HTTP |
| --- | --- | --- |
| **Scan des QR codes** (PNJ, `/scan`) | La caméra (`getUserMedia`) n'est donnée qu'aux pages sécurisées | « La caméra demande une connexion sécurisée » |
| **Connexion 42** | Le cookie de session est `Secure` | Connecté, puis renvoyé sur l'accueil en boucle |
| **Photos** (envoi et affichage) | Servies par l'app elle-même (`/api/photos/…`), donc même origine : pas de *mixed content* | Fonctionne, mais rien d'autre ne marche |
| **Temps réel** | Le navigateur ouvre `wss://` tout seul quand la page est en `https://` | `ws://` refusé par certains réseaux |
| **Lecteur QR sur iPhone** | Le module WASM (`zxing-wasm`) est servi par l'app, pas par un CDN | — |

Points d'attention côté proxy, détaillés plus bas :

- **Taille des photos** : nginx refuse par défaut tout envoi de plus de **1 Mo** (`413`). Les photos sont compressées dans le navigateur (~300 Ko), mais l'app accepte jusqu'à 10 Mo : mets `client_max_body_size 12m`.
- **WebSockets** : nginx ne les transmet que si on lui demande (`Upgrade` / `Connection`).
- **`X-Forwarded-Proto`** : indique à l'app que la requête d'origine était en HTTPS.

## 1. Préparer le serveur

Il faut **Node.js 22+**, **pnpm**, **Docker** (pour PostgreSQL) et **nginx**.

```bash
# Node.js via ton gestionnaire habituel (nvm, paquets NodeSource…), puis :
corepack enable            # fournit pnpm
node --version             # v22 ou plus
```

Crée un utilisateur dédié et récupère le code :

```bash
sudo useradd --system --create-home --home-dir /srv/campudex campudex
sudo -iu campudex
git clone https://github.com/ehosta/jeu-de-piste-2026.git /srv/campudex/app
cd /srv/campudex/app
```

Pare-feu : seuls SSH, 80 et 443 doivent être ouverts.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 2. Configurer l'app (`.env`)

Dans `/srv/campudex/app/.env` (partir de `.env.example`) :

```bash
POSTGRES_USER=campudex
POSTGRES_PASSWORD=<mot de passe long et aléatoire>
POSTGRES_DB=jeu_de_piste
POSTGRES_PORT=5432

NUXT_DATABASE_URL="postgresql://campudex:<le même mot de passe>@localhost:5432/jeu_de_piste"
NUXT_ADMIN_LOGINS=ehosta,fmaudhui,pamuller

# Au moins 32 caractères : `openssl rand -base64 48`. Le changer déconnecte tout le monde.
NUXT_SESSION_PASSWORD=<…>
NUXT_OAUTH2_CLIENT_ID=<…>
NUXT_OAUTH2_CLIENT_SECRET=<…>
NUXT_OAUTH2_REDIRECT_URL=https://campudex.elouann.dev/auth/42

# L'app n'écoute qu'en local, nginx s'occupe du reste.
HOST=127.0.0.1
PORT=3000
```

Pas besoin de `TUNNEL_HOSTNAME` ni de `TUNNEL_TOKEN` en prod.

```bash
chmod 600 .env
```

Dans les réglages de l'app 42 (intra → API), ajoute l'URL de redirection `https://campudex.elouann.dev/auth/42`.

## 3. Base de données et build : `pnpm prod`

```bash
pnpm install --frozen-lockfile
pnpm prod --no-start
```

`pnpm prod` (`scripts/prod.mjs`) fait tout dans l'ordre et s'arrête à la première erreur :

1. démarre PostgreSQL (`docker compose up -d --wait`, seulement si `NUXT_DATABASE_URL` pointe sur `localhost`) et attend qu'il accepte les connexions ;
2. applique les changements du schéma (`prisma db push`, **sans jamais effacer de données** : si un changement en supprimerait, il s'arrête) ;
3. génère le client Prisma et build l'app ;
4. lance l'app au premier plan. Avec `--no-start`, il s'arrête après le build : c'est systemd qui lance l'app (étape 5).

`pnpm prod` sans option est pratique pour un premier essai à la main (`Ctrl+C` arrête tout).

`docker-compose.yaml` n'expose PostgreSQL que sur `127.0.0.1` : Docker contourne `ufw`, une base ouverte sur `0.0.0.0` serait joignable depuis Internet malgré le pare-feu.

> ⚠️ **Jamais `pnpm db:push` ni `pnpm dev:reset` en prod** : ils **effacent toute la base**. `pnpm dev:reset` refuse d'ailleurs de tourner avec `NODE_ENV=production` ou une base qui n'est pas sur `localhost`, mais en prod la base *est* sur `localhost`.

Au premier démarrage, la base vide est remplie depuis `prefill.json` (voir [ADMIN.md](ADMIN.md)).

## 4. À propos du build

Le résultat est dans `.output/`. Build **sur le serveur** (ou sur la même architecture) : `@nuxt/image` y inclut les binaires de `sharp` pour la machine qui build.

`prefill.json` est inclus au build : après l'avoir modifié, rebuild.

## 5. Lancer l'app avec systemd

`/etc/systemd/system/campudex.service` :

```ini
[Unit]
Description=Campudex (jeu de piste)
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=campudex
# Les photos sont écrites dans <WorkingDirectory>/.data/photos : il doit
# rester le même d'un déploiement à l'autre.
WorkingDirectory=/srv/campudex/app
EnvironmentFile=/srv/campudex/app/.env
# Ici plutôt que dans .env, pour ne pas toucher à `pnpm install` (qui
# sauterait les devDependencies, dont la CLI prisma).
Environment=NODE_ENV=production
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Adapte `/usr/bin/node` (`which node`, en particulier avec nvm). Puis :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now campudex
journalctl -u campudex -f       # les logs
curl -s http://127.0.0.1:3000/api/game   # {"phase":"WAITING",…}
```

## 6. nginx (HTTPS, photos, WebSockets)

`/etc/nginx/sites-available/campudex` (puis lien dans `sites-enabled`) :

```nginx
# Upgrade vers WebSocket seulement quand le navigateur le demande.
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name campudex.elouann.dev;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    # nginx < 1.25.1 : enlever cette ligne et écrire `listen 443 ssl http2;`.
    http2 on;
    server_name campudex.elouann.dev;

    # Ton certificat (ici les chemins de certbot / Let's Encrypt).
    ssl_certificate     /etc/letsencrypt/live/campudex.elouann.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/campudex.elouann.dev/privkey.pem;

    # Les téléphones ne retenteront plus jamais en HTTP.
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Photos des quêtes : 10 Mo max côté app, compressées à ~300 Ko par le
    # navigateur. Sans ça, nginx répond 413 au-delà de 1 Mo.
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Temps réel (/_ws).
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        # Les navigateurs envoient un ping toutes les 25 s : une connexion
        # silencieuse plus longtemps est morte.
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

<details>
<summary>Optionnel : limiter le débit (anti-spam)</summary>

L'app n'a pas de limite de requêtes. Pour éviter qu'un compte inonde le serveur (envois de photos en boucle, connexions répétées), dans le bloc `http { }` de `nginx.conf` :

```nginx
limit_req_zone $binary_remote_addr zone=campudex_api:10m rate=10r/s;
```

puis, dans le `server` HTTPS, à côté de `location /` :

```nginx
location /api/ {
    limit_req zone=campudex_api burst=40 nodelay;
    # … mêmes lignes proxy_* que dans `location /` (sans les en-têtes WebSocket)
}
```

Attention : le wifi du campus fait sortir beaucoup de téléphones par **la même IP**. Garde une limite large (ici 10 requêtes/s en moyenne, pics de 40 par IP) et teste-la avant le jour J.
</details>

Si ton certificat n'est pas un certificat certbot, remplace seulement les deux chemins `ssl_certificate*`. Le fichier `fullchain` (certificat **+ chaîne intermédiaire**) est important : sans la chaîne, beaucoup d'Android affichent une erreur alors que le site marche sur ton PC.

<details>
<summary>Variante : Caddy au lieu de nginx</summary>

Caddy gère seul les WebSockets, les en-têtes `X-Forwarded-*`, la redirection HTTP → HTTPS et (s'il le fait lui-même) le certificat :

```
campudex.elouann.dev {
    request_body {
        max_size 12MB
    }
    reverse_proxy 127.0.0.1:3000
}
```

Avec ton propre certificat : `tls /chemin/fullchain.pem /chemin/privkey.pem` dans le bloc.
</details>

## 7. Vérifier

1. `https://campudex.elouann.dev` s'ouvre avec le cadenas, `http://` redirige vers `https://`.
2. Connexion 42 → retour sur le jeu, connecté.
3. **Temps réel** : ouvre **Tableau de bord → Messages**. Le badge « N appareils connectés en direct » compte les navigateurs connectés au WebSocket : ouvre le site sur ton téléphone, le compteur doit augmenter dans les secondes qui suivent. S'il reste à 0, nginx ne transmet pas les WebSockets (étape 6).
4. Envoie un message test « Urgent » à « Tout le monde » : il doit apparaître sur le téléphone sans recharger.
5. **QR codes** : en PNJ (sélecteur de vue → ton PNJ), `/scan` doit demander la caméra.
6. **Photos** : en joueur, envoie une photo prise avec le téléphone (le vrai appareil, pas une capture : c'est elle qui est grosse).

## Mettre à jour

```bash
sudo -iu campudex
cd /srv/campudex/app
git pull
pnpm install --frozen-lockfile
pnpm prod --no-start         # base, schéma, build
exit
sudo systemctl restart campudex
```

Le redémarrage coupe le temps réel quelques secondes : les téléphones affichent « Connexion perdue, reconnexion… », se reconnectent seuls et rechargent ce qu'ils affichent. Évite quand même de redéployer pendant la partie.

## Sauvegardes

Deux choses à sauvegarder, surtout le jour J :

```bash
# La base
docker compose exec -T db pg_dump -U campudex jeu_de_piste | gzip > backup-$(date +%F-%H%M).sql.gz
# Les photos
tar czf photos-$(date +%F-%H%M).tar.gz -C /srv/campudex/app .data/photos
```

L'export JSON de l'admin (**Import JSON → Télécharger un export**) sauvegarde les données de jeu, mais **pas les photos**.

## En cas de problème

| Symptôme | Cause probable |
| --- | --- |
| `502 Bad Gateway` | L'app ne tourne pas ou pas sur ce port : `systemctl status campudex`, `journalctl -u campudex`. |
| Bandeau « Connexion perdue, reconnexion… » permanent, compteur des Messages à 0 | Les WebSockets ne passent pas : en-têtes `Upgrade` / `Connection` manquants dans nginx (étape 6). Le jeu marche quand même, en rechargeant les données toutes les ~25 s. |
| Envoi de photo : erreur, `413` dans les logs nginx | `client_max_body_size` manquant ou trop petit. |
| `/scan` : « connexion sécurisée requise » | Site ouvert en `http://` ou via l'IP : utiliser `https://<domaine>`. |
| Connexion 42 qui boucle vers l'accueil | Cookie `Secure` refusé (site en HTTP), ou `NUXT_SESSION_PASSWORD` changé / trop court. |
| Erreur `redirect_uri` sur la page 42 | `NUXT_OAUTH2_REDIRECT_URL` différent de l'URL déclarée dans l'app 42. |
| Le site répond, mais c'est ton PC (ou rien) | Le DNS pointe encore vers le tunnel (voir l'encadré en haut). |
| Erreur certificat sur Android uniquement | Chaîne intermédiaire manquante : utiliser `fullchain.pem`. |
| Photos disparues après un redéploiement | `WorkingDirectory` changé : elles sont dans l'ancien `.data/photos`. |
| Les notifications arrivent à certains téléphones seulement | Plusieurs instances de l'app derrière le proxy : n'en lancer qu'une. |
