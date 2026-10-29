# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Documentation

- [Concept](docs/CONCEPT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Administration et format JSON](docs/ADMIN.md)
- [Accès public en développement (tunnel)](docs/TUNNEL.md)
- [Mise en production (serveur perso, HTTPS, WebSockets)](docs/DEPLOY.md)
- [Contributing](CONTRIBUTING.md)

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

### Starting from a fresh game

```bash
pnpm dev:reset
```

Starts the database (Docker), **empties it** and deletes the quest photos, then runs `nuxt dev`, which fills the empty database from `prefill.json`. Extra arguments go to `nuxt dev` (`pnpm dev:reset --port 3001`). It refuses to run with `NODE_ENV=production` or on a database that isn't on `localhost`.

Prisma refuses to empty a database when it detects an AI agent such as Claude Code: run it from your own terminal.

### Testing on a phone (same network)

Browsers only give access to the camera (used by the NPC scanner) over HTTPS or on `localhost`. For a quick test from a phone on the same network without the tunnel, run:

```bash
pnpm dev:mobile
```

It serves the app over HTTPS on every network interface, with a self-signed certificate your phone will ask you to accept. Open `https://<your-computer-ip>:3000`, and set `NUXT_OAUTH2_REDIRECT_URL` (and the redirect URI of your 42 app) to `https://<your-computer-ip>:3000/auth/42` so the login redirects back to it.

### Public access (campus wifi and 4G)

`pnpm dev:tunnel` runs the dev server behind a Cloudflare Tunnel, so anyone can reach it at `https://campudex.elouann.dev` from any network, with a real HTTPS certificate. Setup, usage and troubleshooting: [docs/TUNNEL.md](docs/TUNNEL.md) (in French).

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

`pnpm prod` starts the database, applies schema changes (never deleting data), builds and runs the app; `pnpm prod --no-start` stops after the build, for systemd. To put the game online on your own server (HTTPS, WebSockets, photos, no tunnel needed), follow [docs/DEPLOY.md](docs/DEPLOY.md) (in French).
