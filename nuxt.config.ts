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
  // Flat two-tone icons from Solar (bold duotone) in place of emojis, and UI
  // icons from Pixelarticons (pixel art), both in the text's color and installed
  // (@iconify-json/*). The icons found in the code are bundled with the app;
  // any other (e.g. one added while `nuxt dev` runs) comes from our own server,
  // never from the Iconify API.
  icon: {
    provider: "server",
    serverBundle: { collections: ["solar", "pixelarticons"] },
    fallbackToApi: false,
    clientBundle: { scan: true, sizeLimitKb: 512 },
  },
  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      title: "Campudex",
      // The Campudex camera in pixel art (public/favicon.*), and the leather of
      // the header for the phone's browser bar.
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico", sizes: "48x48" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      ],
      meta: [{ name: "theme-color", content: "#2c1d13" }],
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
    // Live updates on /_ws (server/routes/_ws.ts).
    experimental: { websocket: true },
    storage: {
      // Quest photos (server/utils/photo.ts), next to the other local data.
      photos: { driver: "fs", base: "./.data/photos" },
    },
  },
  compatibilityDate: "2025-07-15",
  // Not when the dev server is public through the tunnel: DevTools can read
  // and run things on this machine.
  devtools: { enabled: !tunnelHostname },
  runtimeConfig: {
    // A stolen session cookie stops working after a week (it never did).
    session: {
      maxAge: 60 * 60 * 24 * 7,
      // Set by NUXT_SESSION_PASSWORD.
      password: "",
    },
    databaseUrl: "",
    adminLogins: "",
    oauth2: {
      clientId: "",
      clientSecret: "",
      redirectUrl: "",
    },
  },
});
