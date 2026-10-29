// `pnpm prod`: puts the current code in production on this server (see
// docs/DEPLOY.md). Starts the database, applies schema changes without ever
// deleting data, builds, then runs the app in the foreground.
// `pnpm prod --no-start` stops after the build, when systemd runs the app
// (then `sudo systemctl restart campudex`).
import { isLocalDatabase, loadEnv, serve, step } from "./run.mjs";

loadEnv();

const env = { ...process.env, NODE_ENV: "production" };
const start = !process.argv.includes("--no-start");

// The Docker database of docker-compose.yaml, unless the app uses another one.
if (isLocalDatabase(env.NUXT_DATABASE_URL)) {
  step("Database (Docker)", "docker", ["compose", "up", "-d", "--wait", "db"], env);
}

// Without --force-reset or --accept-data-loss, it stops instead of applying a
// change that would delete data.
step("Database schema", "prisma", ["db", "push"], env);
step("Prisma client", "prisma", ["generate"], env);
step("Build", "nuxt", ["build"], env);

if (start) {
  console.info("\n▶ Starting the app");
  serve("node", [".output/server/index.mjs"], env);
} else {
  console.info("\n✔ Built. Restart the app: sudo systemctl restart campudex");
}
