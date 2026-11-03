#!/usr/bin/env bash
# `bash scripts/deploy.sh`: builds the app and runs it in the foreground, as the
# user that owns the clone. Touches neither the database, nor systemd, nor nginx
# (see docs/DEPLOY.md).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# nvm isn't loaded in a non-interactive shell: without this, no node or pnpm.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  set +u
  . "$NVM_DIR/nvm.sh"
  set -u
fi

[ -f .env ] || { echo "✖ No .env here (start from .env.example)." >&2; exit 1; }

echo "▶ Dependencies"
pnpm install --frozen-lockfile

echo "▶ Build"
NODE_ENV=production pnpm exec nuxt build

echo "▶ Starting the app"
export NODE_ENV=production HOST="${HOST:-127.0.0.1}" PORT="${PORT:-3000}"
exec node --env-file=.env .output/server/index.mjs
