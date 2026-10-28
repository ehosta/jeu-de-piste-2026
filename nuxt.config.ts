// Set by `pnpm dev:tunnel` (scripts/dev-tunnel.mjs) when the dev server is
// reached through the Cloudflare Tunnel.
const tunnelHostname = process.env.DEV_TUNNEL
  ? process.env.TUNNEL_HOSTNAME
  : undefined;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/eslint",
    "@nuxt/fonts",
    "@nuxt/hints",
    "@nuxt/icon/module",
    "@nuxt/image",
    "@nuxt/test-utils/module",
    "nuxt-auth-utils",
  ],
  css: ["~/assets/css/main.css"],
  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      title: "Campudex",
    },
  },
  vite: tunnelHostname
    ? {
        server: {
          // Vite rejects requests for hosts it doesn't know.
          allowedHosts: [tunnelHostname],
          // The browser reaches HMR through the tunnel, on 443. Hot reload
          // then doesn't work on localhost while the tunnel runs.
          hmr: { protocol: "wss", clientPort: 443 },
        },
      }
    : {},
  nitro: {
    storage: {
      // Quest photos (server/utils/photo.ts), next to the other local data.
      photos: { driver: "fs", base: "./.data/photos" },
    },
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  runtimeConfig: {
    databaseUrl: "",
    adminLogins: "",
    oauth2: {
      clientId: "",
      clientSecret: "",
      redirectUrl: "",
    },
  },
});
