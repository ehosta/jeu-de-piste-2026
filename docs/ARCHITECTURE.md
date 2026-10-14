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
