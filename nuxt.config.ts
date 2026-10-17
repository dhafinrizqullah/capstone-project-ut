// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/supabase', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  // ponytail: mockup hanya desain terang — kunci light, dark mode menyusul bila diminta
  colorMode: {
    preference: 'light',
    storageKey: 'banksampah-color-mode',
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'id' }
    }
  }
})
