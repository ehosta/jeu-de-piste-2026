# Architecture

## Tech stack

- **Framework:** [Nuxt](https://nuxt.com/), mono-stack / mono-repo (frontend and backend in the same app)
- **Database:** [PostgreSQL](https://www.postgresql.org/)

## Project structure

```
app/              # Nuxt app (pages, components, layouts…)
  app.vue         # Root component
public/           # Static assets served as-is
test/
  unit/           # Unit tests (Vitest)
  nuxt/           # Nuxt component tests (Vitest + Nuxt env)
tests/            # E2E tests (Playwright)
docs/             # Project documentation
nuxt.config.ts    # Nuxt configuration and modules
vitest.config.ts  # Vitest configuration
playwright.config.ts # Playwright configuration
```
