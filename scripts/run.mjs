// Shared by the start scripts (dev-reset.mjs, prod.mjs).
import { spawn, spawnSync } from "node:child_process";

export function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: rely on the environment.
  }
}

// Runs a step, and stops everything if it fails.
export function step(title, command, args, env = process.env) {
  console.info(`\n▶ ${title}`);
  const { status, error } = spawnSync(command, args, { stdio: "inherit", env });

  if (error || status !== 0) {
    console.error(`✖ ${title}: failed${error ? ` (${error.message})` : ""}.`);
    process.exit(status || 1);
  }
}

// Runs the app in the foreground until it stops or Ctrl+C.
export function serve(command, args, env = process.env) {
  const child = spawn(command, args, { stdio: "inherit", env });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }

  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (error) => {
    console.error(error.message);
    process.exit(1);
  });
}

// The database the app uses lives on this machine.
export function isLocalDatabase(url) {
  try {
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
