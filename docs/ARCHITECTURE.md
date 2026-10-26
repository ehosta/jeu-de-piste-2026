# Architecture

## Tech stack

- **Framework:** [Nuxt](https://nuxt.com/), mono-stack / mono-repo (frontend and backend in the same app)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **ORM:** [Prisma](https://www.prisma.io/) 7, with the `@prisma/adapter-pg` driver adapter

## Project structure

```
app/              # Nuxt app (pages, components, layouts…)
  app.vue         # Root component
server/           # Nitro server (API routes, server utils)
  utils/db.ts     # Shared Prisma client instance
prisma/           # Prisma schema, split into one file per model
  schema.prisma   # Generator and datasource
  generated/      # Generated Prisma client (git-ignored)
public/           # Static assets served as-is
test/             # Tests (Vitest + Nuxt environment)
docs/             # Project documentation
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

Only NPCs can scan. A scan returns the team (name, members) and, for each of the NPC's own quests, the `actions` its status allows (`shared/utils/quest-actions.ts`):

| Status | Actions | Result |
| --- | --- | --- |
| `HIDDEN` (no `TeamQuest` row yet) | `GIVE` | `GIVEN` |
| `SUBMITTED` | `VALIDATE` / `REJECT` | `VALIDATED` (locked) / `REJECTED` |
| `GIVEN`, `REJECTED`, `VALIDATED` | none | the NPC is shown an "oops" message |

`POST /api/qrcode/action` checks the status again and only writes if it hasn't changed since (conditional `updateMany` / `createMany` with `skipDuplicates`), so a stale screen or a double tap returns `409` instead of e.g. rejecting a validated quest.

The NPC scanner lives at `/scan` (`app/pages/scan.vue`) and uses [`vue-qrcode-reader`](https://github.com/gruhn/vue-qrcode-reader). Browsers only expose the camera over HTTPS (or on `localhost`), see `pnpm dev:mobile` in the README. Browsers without a native `BarcodeDetector` (Safari on iOS) decode with a WASM module, served by the app (`zxing-wasm`, pinned to the version bundled by `vue-qrcode-reader`) instead of the default CDN.

## Quest photos

| Route | Roles | Description |
| --- | --- | --- |
| `POST /api/teams/me/quests/:questId/photo` (multipart, `photo`) | `PLAYER` | Sends or retakes the team's photo: the quest becomes `SUBMITTED` |
| `GET /api/photos/:key` | team members, the quest's NPC, admins | The photo itself |

A team can send its photo once given the quest and retake it while it is `GIVEN`, `SUBMITTED` or `REJECTED` (`canSubmitPhoto` in `shared/utils/quest-actions.ts`). Once `VALIDATED`, it is locked.

- **Client:** photos are resized (max 1600 px) and re-encoded as JPEG in the browser before upload (`app/utils/compress-photo.ts`), so a several-MB phone photo becomes ~300 KB, and HEIC turns into a format every browser displays. The player page polls every 10 s, so the NPC's decision shows up without reloading.
- **Server:** the type is checked from the file's first bytes (JPEG, PNG or WebP, 10 MB max). Files go to the `photos` Nitro storage (`.data/photos`, git-ignored) under a new key on every upload, saved in `TeamQuest.photoPath`. The previous file is deleted, and so is the photo when an admin resets a quest to `HIDDEN`.
- **Review:** the NPC sees the photo and the quest's expected `answer` when scanning. `VALIDATE`/`REJECT` send back the `photoPath` they saw: if the team retook the photo in the meantime, the action returns `409` instead of validating a photo nobody looked at.

## Admin & testing

`/admin` (`app/pages/admin.vue`) is reserved to users whose **real** role is `ADMIN` (the logins in `NUXT_ADMIN_LOGINS`).

| Route | Description |
| --- | --- |
| `GET /api/admin/overview` | Teams (members, status on each quest) and NPCs (quests) |
| `POST /api/admin/act-as` `{ role, teamId?, npcId? }` | Play as a player of a team (`PLAYER`) or as an NPC (`NPC`), or switch back (`ADMIN`) |
| `POST /api/admin/test-data` | Creates the "Les Testeurs" team and a "PNJ de test" with two quests (idempotent) |
| `POST /api/admin/team-members` `{ teamId, intraLogin }` | Puts a player in a team by 42 login, even before their first login (`409` for an admin or NPC) |
| `DELETE /api/admin/team-members` `{ intraLogin }` | Removes a player from their team |
| `PUT /api/admin/team-quest` `{ teamId, questId, status }` | Forces a team's status on a quest, e.g. `SUBMITTED` to simulate a photo, `HIDDEN` to replay |

Impersonation is stored in the server-only part of the session (`secure.actingAs`), so it only applies to that browser: an admin can be an NPC on their phone and stay admin on their computer. Their real role in the database stays `ADMIN`. `getActor` (`server/utils/auth.ts`) resolves the effective role, team and NPC for `requireRole`, and `requireAdmin` ignores impersonation so the admin can always switch back.
