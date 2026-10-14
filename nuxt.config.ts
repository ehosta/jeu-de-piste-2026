// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/fonts', '@nuxt/hints', '@nuxt/icon/module', '@nuxt/image', '@nuxt/test-utils/module'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true }
})
