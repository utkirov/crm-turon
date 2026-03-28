// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
    '@nuxt/fonts',
  ],

  fonts: {
    families: [{ name: 'Inter', provider: 'google' }],
    defaults: { weights: [400, 500, 600, 700, 800, 900] },
  },

  app: {
    pageTransition: { name: 'page' },
    layoutTransition: false,
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  nitro: {
    experimental: {
      openAPI: true,
    },
  },

  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET ?? 'aec-flow-dev-secret-32-chars-!!!',
  },

  compatibilityDate: '2025-01-15'
})
