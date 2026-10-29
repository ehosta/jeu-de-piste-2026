// `pnpm dev:reset`: starts development from a fresh game every time. Empties
// the database and the quest photos, then runs `nuxt dev`, which fills the
// empty database from prefill.json on startup (server/plugins/init-db.ts).
// Extra arguments go to `nuxt dev` (e.g. `pnpm dev:reset --port 3001`).
import { rmSync } from "node:fs";
import { isLocalDatabase, loadEnv, serve, step } from "./run.mjs";

loadEnv();

// Wiping is only for a database on this machine: never a shared or
// production one by mistake.
const url = process.env.NUXT_DATABASE_URL;

if (process.env.NODE_ENV === "production" || !isLocalDatabase(url)) {
  console.error(
    "pnpm dev:reset wipes the database: it only runs on a local database (NUXT_DATABASE_URL on localhost) outside production.",
  );
  process.exit(1);
}

step("Database (Docker)", "docker", ["compose", "up", "-d", "--wait", "db"]);
rmSync("prisma/migrations", { recursive: true, force: true });
step("Empty the database", "prisma", ["db", "push", "--force-reset"]);
step("Prisma client", "prisma", ["generate"]);

// The photos of the wiped game.
rmSync(".data/photos", { recursive: true, force: true });
console.info("\n▶ Quest photos deleted, starting Nuxt (prefill.json fills the database)");

serve("nuxt", ["dev", ...process.argv.slice(2)]);
