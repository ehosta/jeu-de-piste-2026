# Architecture

## Tech stack

- **Framework:** [Nuxt](https://nuxt.com/), mono-stack / mono-repo (frontend and backend in the same app)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **ORM:** [Prisma](https://www.prisma.io/) 7, with the `@prisma/adapter-pg` driver adapter
- **File storage:** [SeaweedFS](https://github.com/seaweedfs/seaweedfs), through its S3-compatible API

## Project structure

```
app/              # Nuxt app (pages, components, layouts…)
  app.vue         # Root component
server/           # Nitro server (API routes, server utils)
  utils/db.ts     # Shared Prisma client instance
  utils/s3.ts     # Shared S3 client (SeaweedFS)
docker/           # Config mounted into the docker compose services
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

## Photo storage

Quest photos are stored in [SeaweedFS](https://github.com/seaweedfs/seaweedfs), started by `docker compose` alongside Postgres. The app talks to it via its S3-compatible API with `@aws-sdk/client-s3`, so any S3 provider can replace it by changing the `NUXT_S3_*` variables.

- S3 credentials are declared in `docker/seaweedfs/s3.json` (dev values; replace them in production).
- The bucket (`NUXT_S3_BUCKET`) is created on startup by `server/plugins/init-s3.ts`.
- Only the object key is stored in the database (`TeamQuest.photoPath`); the files are never public.
- `PUT /api/team-quests/:id/photo` (multipart field `photo`): a team member uploads or replaces the photo, unless the quest is hidden or already validated.
- `GET /api/team-quests/:id/photo`: streams the photo to team members, the quest's NPC and admins.
