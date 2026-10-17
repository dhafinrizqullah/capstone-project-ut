// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/supabase', '@nuxt/eslint', '@nuxtjs/i18n'],
  // ponytail: cookie Secure ditolak browser di http://localhost — hanya aktif di production (https)
  supabase: {
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  i18n: {
    defaultLocale: 'id',
    locales: [
      { code: 'id', language: 'id-ID', name: 'Indonesia', file: 'id.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
  },
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
