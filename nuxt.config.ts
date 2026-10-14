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
