// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/supabase', '@nuxt/eslint', '@nuxtjs/i18n'],
  // ponytail: browsers reject Secure cookies over http://localhost — enable only in production (https)
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
  // NUXT_PUBLIC_SITE_URL pins the public origin for link previews (only needed behind
  // a proxy that rewrites the host header); otherwise the request's own origin is used.
  runtimeConfig: {
    public: {
      siteUrl: '',
    },
  },
  // follows the OS by default; users can override with the sidebar toggle
  colorMode: {
    preference: 'system',
    fallback: 'light',
    storageKey: 'banksampah-color-mode',
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      // the brand mark: emerald tile + recycle glyph (same mark as the login page and sidebar)
      link: [
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    }
  }
})
