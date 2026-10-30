#!/usr/bin/env bash
# `sudo bash scripts/deploy.sh [--pull]`: puts the app in production on this
# server, from first install to update (see docs/DEPLOY.md). Run it from the
# clone, which must belong to the user that runs the app. Builds, installs the
# systemd service and the nginx site, then restarts everything.
# --pull first updates the code with `git pull`.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE=/etc/systemd/system/campudex.service
SITE=/etc/nginx/sites-available/campudex
SITE_LINK=/etc/nginx/sites-enabled/campudex

fail() { echo "✖ $1" >&2; exit 1; }
step() { echo; echo "▶ $1"; }
env_value() { sed -nE "s/^$1=\"?([^\"]*)\"?\$/\1/p" "$APP_DIR/.env" | tail -1; }

[ "$(id -u)" -eq 0 ] || fail "Run it with sudo: sudo bash scripts/deploy.sh"
APP_USER="$(stat -c %U "$APP_DIR")"
[ "$APP_USER" != root ] || fail "$APP_DIR belongs to root: it must belong to the user that runs the app."

as_app() { sudo -iu "$APP_USER" bash -c "cd '$APP_DIR' && $1"; }

# Everything that can be wrong is checked before anything changes.
[ -f "$APP_DIR/.env" ] || fail "No .env in $APP_DIR (start from .env.example)."
[ -d "$(dirname "$SITE")" ] || fail "nginx is not installed (no $(dirname "$SITE"))."
command -v docker > /dev/null || fail "Docker is not installed."

REDIRECT_URL="$(env_value NUXT_OAUTH2_REDIRECT_URL)"
DOMAIN="$(sed -nE 's#^https://([^/:]+).*#\1#p' <<< "$REDIRECT_URL")"
[ -n "$DOMAIN" ] || fail "NUXT_OAUTH2_REDIRECT_URL must be https://<domain>/auth/42 (it gives the domain)."

# Certbot's paths, unless .env gives others.
SSL_CERT="$(env_value SSL_CERT)"
SSL_KEY="$(env_value SSL_KEY)"
SSL_CERT="${SSL_CERT:-/etc/letsencrypt/live/$DOMAIN/fullchain.pem}"
SSL_KEY="${SSL_KEY:-/etc/letsencrypt/live/$DOMAIN/privkey.pem}"
[ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ] || fail "No certificate at $SSL_CERT. Get one (sudo certbot certonly --nginx -d $DOMAIN), or set SSL_CERT and SSL_KEY in .env."

NODE="$(as_app 'command -v node')" || fail "Node.js is not installed for $APP_USER."

# `pnpm prod` starts the Docker database as this user.
case "$(env_value NUXT_DATABASE_URL)" in
  *@localhost*|*@127.0.0.1*)
    id -nG "$APP_USER" | grep -qw docker || usermod -aG docker "$APP_USER"
    ;;
esac

if [ "${1:-}" = --pull ]; then
  step "Code (git pull)"
  as_app "git pull --ff-only"
fi

step "Dependencies, database and build"
as_app "pnpm install --frozen-lockfile && pnpm prod --no-start"

step "App service (systemd)"
sed -e "s|^User=.*|User=$APP_USER|" \
    -e "s|/srv/campudex/app|$APP_DIR|g" \
    -e "s|^ExecStart=/usr/bin/node|ExecStart=$NODE|" \
    "$APP_DIR/deploy/campudex.service" > "$SERVICE"
systemctl daemon-reload
systemctl enable campudex
systemctl restart campudex

step "Waiting for the app"
for _ in $(seq 1 30); do
  curl -fs -o /dev/null http://127.0.0.1:3000/api/game && break
  sleep 1
done
curl -fs -o /dev/null http://127.0.0.1:3000/api/game || fail "The app doesn't answer: journalctl -u campudex -n 50"

step "nginx ($DOMAIN)"
[ -f "$SITE" ] && cp "$SITE" "$SITE.bak"
sed -e "s|campudex\.elouann\.dev;|$DOMAIN;|" \
    -e "s|ssl_certificate  *.*|ssl_certificate     $SSL_CERT;|" \
    -e "s|ssl_certificate_key  *.*|ssl_certificate_key $SSL_KEY;|" \
    "$APP_DIR/deploy/campudex.nginx.conf" > "$SITE"
ln -sf "$SITE" "$SITE_LINK"
# A broken site would stop nginx at its next restart, with every other site.
if ! nginx -t; then
  if [ -f "$SITE.bak" ]; then mv "$SITE.bak" "$SITE"; else rm -f "$SITE" "$SITE_LINK"; fi
  fail "Invalid nginx config: previous one restored."
fi
systemctl reload-or-restart nginx

echo
echo "✔ Deployed: https://$DOMAIN"
