// Runs the dev server behind a Cloudflare Tunnel, so the game is reachable
// from anywhere (campus wifi or 4G) at https://$TUNNEL_HOSTNAME, with a real
// certificate. Setup: see "Public access" in the README.
import { spawn } from "node:child_process";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: rely on the environment.
}

const { TUNNEL_HOSTNAME, TUNNEL_TOKEN } = process.env;

if (!TUNNEL_HOSTNAME || !TUNNEL_TOKEN) {
  console.error(
    "TUNNEL_HOSTNAME and TUNNEL_TOKEN must be set in .env (see README, \"Public access\").",
  );
  process.exit(1);
}

// The tunnel's public hostname must point to this port in Cloudflare.
const PORT = "3000";

const env = {
  ...process.env,
  // Read by nuxt.config.ts to accept requests coming through the tunnel.
  DEV_TUNNEL: "1",
  // 42 sends players back to the public URL after logging in.
  NUXT_OAUTH2_REDIRECT_URL: `https://${TUNNEL_HOSTNAME}/auth/42`,
};

const children = [
  spawn("nuxt", ["dev", "--port", PORT], { stdio: "inherit", env }),
  // Reads its token from TUNNEL_TOKEN, so it doesn't show up in `ps`.
  spawn("cloudflared", ["tunnel", "--no-autoupdate", "run"], {
    stdio: "inherit",
    env,
  }),
];

let exiting = false;

function stop(code) {
  if (exiting) {
    return;
  }

  exiting = true;

  for (const child of children) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  }

  process.exitCode = code;
}

// If either process stops, the other one is useless: stop both.
for (const child of children) {
  child.on("exit", (code) => stop(code ?? 1));
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
