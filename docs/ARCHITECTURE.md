# Architecture

## Tech stack

- **Framework:** [Nuxt](https://nuxt.com/), mono-stack / mono-repo (frontend and backend in the same app)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **ORM:** [Prisma](https://www.prisma.io/) 7, with the `@prisma/adapter-pg` driver adapter

## Project structure

```
app/              # Nuxt app (pages, components, layouts…)
  app.vue         # Root component
  i18n/           # French (reference) and English messages
server/           # Nitro server (API routes, server utils)
  utils/db.ts     # Shared Prisma client instance
prisma/           # Prisma schema, split into one file per model
  schema.prisma   # Generator and datasource
  generated/      # Generated Prisma client (git-ignored)
public/           # Static assets served as-is
test/             # Tests (Vitest + Nuxt environment)
docs/             # Project documentation
prefill.json      # Data an empty database starts with (admin patch format)
nuxt.config.ts    # Nuxt configuration and modules
prisma7.config.ts # Prisma configuration (schema path, migrations, DATABASE_URL)
vitest.config.ts  # Vitest configuration
```

## Database access

Database access goes through [Prisma](https://www.prisma.io/), chosen for:

- **Type safety:** the client is generated from the schema, so queries and results are fully typed end to end in the Nuxt server.
- **Declarative schema & migrations:** the data model lives in `prisma/*.prisma` and migrations are generated from it (`prisma/migrations`).

A single `PrismaClient` is exported from `server/utils/db.ts` and auto-imported in server code. In development it is cached on `globalThis` to avoid opening a new connection pool on every hot reload.

## QR codes

Each team has an opaque `qrToken` (UUID) stored on its `Team` row. That token is the only thing a QR code carries. The image is rendered as SVG when it's requested (`server/utils/qrcode.ts`), so no image files are stored.

| Route | Roles | Description |
| --- | --- | --- |
| `GET /api/teams/me` | `PLAYER` | The player's team: name, members and the quests it was given (`null` if none) |
| `GET /api/teams/me/qrcode` | `PLAYER` | SVG QR code of the player's own team |
| `GET /api/teams/:id/qrcode` | `ADMIN` | SVG QR code of any team |
| `POST /api/qrcode/scan` `{ token }` | `NPC` | Resolves a scanned token to the team and its status on the NPC's quests |
| `POST /api/qrcode/action` `{ token, questId, action, photoPath }` | `NPC` | Applies `GIVE`, `VALIDATE` or `REJECT` to one of the NPC's quests for that team |

Roles are reloaded from the database on every request (`requireRole` in `server/utils/auth.ts`), and in the session the app fetches on each page load (`server/plugins/session.ts`), so role changes take effect without logging in again.

Only NPCs can scan. A quest can be shared between several NPCs (`Quest.npcs`, many-to-many): any of them can give and review it, and `TeamQuest.givenBy` / `validatedBy` record which one did. NPCs can also be put in an **NPC group** (`NpcGroup`, `Npc.groupId`; null means solo): they then give and review every quest of every member of the group. Quests stay attached to their NPC, so the group only widens access: `npcQuestsWhere()` in `server/utils/npc.ts` is the one condition used by the scan, the actions, the NPC profile, and `questGivers()` lists who can give a quest (photos, the player's "can also be reviewed by", live updates). A scan returns the team (name, members) and, for each of the NPC's quests (shared ones included), the `actions` its status allows (`shared/utils/quest-actions.ts`):

| Status | Actions | Result |
| --- | --- | --- |
| `HIDDEN` (no `TeamQuest` row yet) | `GIVE` | `GIVEN` |
| `SUBMITTED` | `VALIDATE` / `REJECT` | `VALIDATED` (locked) / `REJECTED` |
| `GIVEN`, `REJECTED`, `VALIDATED`, `BLOCKED` | none | the NPC is shown an "oops" message |

`BLOCKED` is only set by an admin (/admin/photos), to cancel a validation an NPC shouldn't have given and keep the team from trying again.

`POST /api/qrcode/action` checks the status again and only writes if it hasn't changed since (conditional `updateMany` / `createMany` with `skipDuplicates`), so a stale screen or a double tap returns `409` instead of e.g. rejecting a validated quest.

The NPC scanner lives at `/scan` (`app/pages/scan.vue`) and uses [`vue-qrcode-reader`](https://github.com/gruhn/vue-qrcode-reader). Browsers only expose the camera over HTTPS (or on `localhost`), see `pnpm dev:mobile` in the README. Browsers without a native `BarcodeDetector` (Safari on iOS) decode with a WASM module, served by the app (`zxing-wasm`, pinned to the version bundled by `vue-qrcode-reader`) instead of the default CDN.

## Quest photos

| Route | Roles | Description |
| --- | --- | --- |
| `POST /api/teams/me/quests/:questId/photo` (multipart, `photo`) | `PLAYER` | Sends the team's photo: the quest becomes `SUBMITTED` (`409` "Photo pending" if a teammate already sent one) |
| `DELETE /api/teams/me/quests/:questId/photo` | `PLAYER` | Withdraws the photo waiting for review: the quest is back to `GIVEN` |
| `GET /api/photos/:key` | team members, the quest's NPCs, admins | The photo itself |

Any member of a team can send its photo once the quest is `GIVEN` or `REJECTED` (`canSubmitPhoto` in `shared/utils/quest-actions.ts`), and who sent it is saved (`TeamQuest.submittedBy`). Only one photo is under review at a time: while `SUBMITTED`, nobody in the team can send another (two uploads at once: the first wins, the update is conditional on the status), but any member can withdraw it to retake it (`canWithdrawPhoto`). Once `VALIDATED`, it is locked.

- **Client:** photos are resized (max 1600 px) and re-encoded as JPEG in the browser before upload (`app/utils/compress-photo.ts`), so a several-MB phone photo becomes ~300 KB, and HEIC turns into a format every browser displays. The NPC's decision shows up live on the player page (see [Live updates](#live-updates)).
- **Server:** the type is checked from the file's first bytes (JPEG, PNG or WebP, 10 MB max). Files go to the `photos` Nitro storage (`.data/photos`, git-ignored) under a new key on every upload, saved in `TeamQuest.photoPath`. The previous file is deleted, and so is the photo when an admin resets a quest to `HIDDEN`.
- **Review:** the NPC sees the photo and the quest's expected `answer` when scanning. `VALIDATE`/`REJECT` send back the `photoPath` they saw: if the team withdrew or retook the photo in the meantime, the action returns `409` instead of validating a photo nobody looked at.

## Admin

`/admin` is reserved to users whose **real** role is `ADMIN` (including the logins in `NUXT_ADMIN_LOGINS`) or `BOCAL`. Bocal members see the same pages read-only: routes that only show the game use `requireStaff`, everything that changes it `requireAdmin`. Pages, the JSON patch format and the routes are documented in [ADMIN.md](ADMIN.md) (in French).

Every admin edit, from the dashboard buttons to a large JSON import, goes through `POST /api/admin/patch`: a document validated by `shared/utils/admin-patch.ts` (also used by the editor, to report errors as you type) and applied in a single transaction by `server/utils/admin-patch.ts`. Rows reference each other by readable keys (42 login, team name, quest `key`), and deletes cascade in the database (`onDelete: Cascade`). A quest left without any NPC at the end of a patch is deleted. Photo files left without a `TeamQuest` are removed afterwards (`deleteOrphanPhotos`).

Impersonation is stored in the server-only part of the session (`secure.actingAs`), so it only applies to that browser: an admin can be an NPC on their phone and stay admin on their computer. Their real role in the database stays `ADMIN`. `getActor` (`server/utils/auth.ts`) resolves the effective role, team and NPC for `requireRole`, and `requireAdmin`/`requireStaff` ignore impersonation so the admin can always switch back. Bocal members can only act as their own player and NPC versions (`isOwnVersion`).

## Access and game state

Users are matched by 42 login. The single `Game` row holds the phase and the pause:

- `WAITING` (before the game): logging in with an unknown 42 account creates a player without a team. Admins form the teams, by hand or with the generator (`shared/utils/team-generator.ts` and `shared/utils/team-names.ts`, applied through a patch).
- `RUNNING`: logging in never creates a user. An unknown account gets a session with `role: null`, is sent to `/attente` by `app/middleware/registered.global.ts`, and is recorded in `WaitingUser` so admins can place it. Going back to `WAITING` turns those accounts into players.

Before the game and while it is paused, `requireGameRunning` makes NPC actions and photo uploads answer `423` (`Game not started` or `Game paused`), and every page shows a banner (`GET /api/game`, refreshed live by `app.vue`). Admins acting as a player or NPC are only let through during a pause, to test or fix things. The NPC home and /scan show why scanning is closed (`useGameLock`).

An empty database (no `Game` row) is filled at startup from `prefill.json` (`server/plugins/init-db.ts`, `server/utils/prefill.ts`), which admins can apply again from Maintenance.

## Leaderboard and log

Points aren't stored: `computeScores()` (`server/utils/scores.ts`) recomputes them from the validated `TeamQuest` rows, ordered by `validatedAt`, so a team's rank on a quest is its position among the teams that validated it. The formula (100 points per difficulty level, +50% for the first team, 10 points less per next team down to +0%) is in `shared/utils/scoring.ts`. The admins' team (`sandbox`, see `server/utils/admins.ts`) never counts in the order of the real teams; admins see it in the leaderboard and the log (`sandbox: true`) with the rank it would have. `GET /api/leaderboard`, `GET /api/logs` and `GET /api/teams/me` (points, rank, total number of quests, to show the end-of-Campudex message) all use it.

## Languages

The interface is in French and English, with a small in-house helper rather than a module: `app/i18n/fr.ts` is the reference and `en.ts` is typed against it, so a missing or extra key fails the type check, and so does `t()` with an unknown key. `useI18n()` (`app/composables/useI18n.ts`) picks the language from the `lang` cookie (FR/EN switch in the header), or else the `Accept-Language` header / the browser's language. Messages use `{param}` placeholders and `"one | many"` plural forms; `<I18nText>` renders messages that contain markup.

The server stays language-neutral: errors are status messages used as codes (`Photo pending`, `Game not started`…), admin patch issues are `{ path, code, params }` translated by the client, and the impersonation banner gets `{ kind, name }`.

## Live updates

Every logged-in browser keeps a WebSocket open on `/_ws` (`server/routes/_ws.ts`, Nitro's `experimental.websocket`), so phones follow the game without polling: a validation shows on the team's page, a photo on the NPC's scanner and in /admin, a pause on every screen, as soon as it happens.

- **Server** (`server/utils/realtime.ts`): only the session cookie of the upgrade request identifies the account. Each socket is subscribed to topics derived from it like `requireRole` does (`all`, `role:<role>`, `team:<id>`, `npc:<id>`, `staff`, `login:<login>`). Routes that change the game call `publish()` with the events concerned (`shared/utils/realtime.ts`): only **which data changed**, never the data itself, so nothing leaks to a socket that shouldn't see it; each page refetches through its usual, access-checked route. After an admin patch or the prefill, `publishEverything()` resolves every socket's topics again (an account placed in a team, promoted to NPC…) and sends `session` to the ones that changed.
- **Client** (`app/plugins/realtime.client.ts`): opens the socket while someone is logged in, and a new one when the session changes (login, logout, admin switching views). It pings every 25 s and treats a silent socket as dead (phones switching from wifi to 4G keep dead sockets open), reconnects with backoff, right away when the phone wakes up, and since events sent meanwhile are lost, makes every page refetch everything once reconnected. While disconnected it shows a banner after 5 s and still makes pages refetch every ~25 s. Pages subscribe with `useRealtime(events, refresh)`.
- **One process**: subscriptions live in memory, so the app must run as a single instance (see [DEPLOY.md](DEPLOY.md)).

| Event | Sent to | Refetched |
| --- | --- | --- |
| `game` | everyone | `GET /api/game` (banners, locks) |
| `scores` | everyone | leaderboard, log, the team's points |
| `team` | the team (all players for an NPC renamed) | `GET /api/teams/me` |
| `npc` | the NPC (all NPCs for a renamed one) | `GET /api/npc/me` |
| `scan` | the NPCs of the quest whose progress changed | the team on the scanner (`/scan`) |
| `admin` | admins and bocal | `GET /api/admin/state` (every admin page) |
| `session` | accounts whose role, team or NPC changed | the session (`/attente` then leaves on its own) |
| `notifications` | everyone | `GET /api/notifications` |
| `presence` | admins and bocal (debounced) | the connected count on /admin/notifications |

## Notifications

Admins push messages to the screens (/admin/notifications, `prisma/notification.prisma`): to everyone, the players, the NPCs or one team, for a while (5 min to 2 h) or until taken down, and optionally **urgent** (shown in front of the page until acknowledged, the phone vibrates) instead of a bubble that goes away on its own. Every screen has a bell in the header with the unread count and the messages still showing (`app/components/NotificationCenter.vue`); what was read or hidden is remembered per device (`localStorage`). Who sees what follows the effective role (`notificationsWhereFor` in `server/utils/notifications.ts`): an admin acting as a player sees the players' messages, accounts waiting on /attente only the ones sent to everyone.

They are kept apart from the admin patch: sending or taking one down doesn't change the game, isn't exported, and taking one down deletes it.

| Route | Roles | Description |
| --- | --- | --- |
| `GET /api/notifications` | logged in | The messages showing for this account, newest first |
| `GET /api/admin/notifications` | `ADMIN`, `BOCAL` | Every message showing, and how many browsers are connected live |
| `POST /api/admin/notifications` `{ message, audience, teamId?, urgent, duration }` | `ADMIN` | Sends one (`shared/utils/notifications.ts`); `400` with `data.issue` if invalid |
| `DELETE /api/admin/notifications/:id` / `DELETE /api/admin/notifications` | `ADMIN` | Takes one / every message down from the screens |

## Security

What protects the app, beyond the role checks of each route (`requireRole`, `requireAdmin`, `requireStaff`):

- **Session**: sealed cookie (`nuxt-auth-utils`, `NUXT_SESSION_PASSWORD`), `HttpOnly`, `Secure`, `SameSite=Lax`, valid 7 days. Roles are read from the database on every request, never trusted from the cookie.
- **42 login** (`server/routes/auth/42.get.ts`): the OAuth `state` must match the `oauth_state` cookie, both present, so a link carrying someone else's code can't log a visitor into that account.
- **Cross-origin requests** (`server/middleware/security.ts`, `isCrossOriginRequest` in `server/utils/security.ts`): requests that change something, and the WebSocket handshake, are refused (`403`) when `Sec-Fetch-Site` (or else `Origin`) shows they come from another origin, sibling subdomains included, which `SameSite=Lax` lets through.
- **Body sizes**: 64 KB for JSON, 5 MB for an admin patch, 10 MB for a photo (checked by its route), and in production no body without a `Content-Length`; WebSocket messages are capped at 1 KB (`server/plugins/websocket.ts`).
- **Headers**: `nosniff` (a photo can't be run as a page), framing by other sites forbidden, camera only for the app itself (`Permissions-Policy`). HSTS is set by nginx (see [DEPLOY.md](DEPLOY.md)).
- **Content**: everything users type (team and NPC names, messages) is rendered as text by Vue, never as HTML (no `v-html`); photos are only served with the image type read from their first bytes; QR codes only carry a random token.
- **Development**: DevTools are off when the dev server is public through the tunnel; the database only listens on `127.0.0.1`.

## Icons

No emoji or symbol characters in the interface (they look different on every phone, or not at all): flat two-tone icons from [Solar](https://icon-sets.iconify.design/solar/) (`*-bold-duotone`) stand in for emojis, and UI icons come from [Pixelarticons](https://icon-sets.iconify.design/pixelarticons/) (pixel art), both in the text's color, through `@nuxt/icon`: `<Icon name="solar:bell-bing-bold-duotone" class="ico" aria-hidden="true" />`. Difficulties use `<DifficultyStars :difficulty="3" />`.

Both collections are installed (`@iconify-json/*`), never fetched from the Iconify API (`nuxt.config.ts`): the icons whose names are written literally in the code are bundled with the app; any other comes from our own server (`/api/_nuxt_icon`). Ornaments drawn in CSS (the eyebrow sparkle, the ▶ of `<summary>`, the ▼ of dialogue boxes) are Pixelarticons masks: `background: currentColor; mask: var(--glyph-…)` (`app/assets/css/main.css`).

## Names

| Route | Role | Effect |
| --- | --- | --- |
| `GET /api/npc/me` / `PATCH /api/npc/me` `{ name }` | `NPC` | The NPC's profile and quests; renames the NPC |
| `POST /api/teams/me/name` `{ locale }` | `PLAYER` | Draws a new random, unused team name (`shared/utils/team-names.ts`) |
