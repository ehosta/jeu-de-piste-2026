import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['test/**/*.{test,spec}.ts'],
    // The on-disk module cache stores Nuxt's test entry with relative import
    // paths that no longer resolve on the next run, breaking every suite.
    fsModuleCache: false,
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
      },
    },
    coverage: {
      enabled: true,
      provider: 'v8',
    },
  },
})
