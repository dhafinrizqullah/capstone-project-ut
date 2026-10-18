/**
 * Head concerns that depend on the route, the locale, or the colour mode, plus
 * the two things a mode flip has to keep in sync: the browser chrome colour and
 * the transition that makes the swap smooth.
 *
 * - Title: "<page title> · <brand>", in the active locale. A page opts in with
 *   `definePageMeta({ titleKey: '<i18n key>' })`; without one the title is just
 *   the brand, so a new page is never title-less.
 * - Link previews: the Open Graph / Twitter tags a chat app reads when the URL is
 *   shared. Crawlers never run the app, so they must be in the server-rendered
 *   HTML and every URL in them absolute — a relative og:image is dropped silently.
 * - Theme colour: the mobile browser chrome follows the painted background,
 *   including when the user overrides the OS preference from the sidebar.
 * - Theme switch: while the mode changes, <html> carries `theme-switching`, the
 *   only time surfaces are told to tween their colours (see main.css).
 */
const SWITCH_MS = 320

export default defineNuxtPlugin(() => {
  const route = useRoute()
  const { $i18n } = useNuxtApp()
  const themeColor = ref('')

  // The site may sit behind a proxy that rewrites the host header: NUXT_PUBLIC_SITE_URL
  // pins the public origin, otherwise the request's own origin is used.
  const { public: { siteUrl } } = useRuntimeConfig()
  const origin = (siteUrl as string) || useRequestURL().origin
  const absolute = (path: string) => new URL(path, origin).toString()

  const paintThemeColor = () => {
    const html = document.documentElement
    const bg = getComputedStyle(html).getPropertyValue('--ui-bg').trim()
    themeColor.value = bg || (html.classList.contains('dark') ? '#0f172a' : '#ffffff')
  }

  let switchTimer: ReturnType<typeof setTimeout> | undefined
  let wasDark = false
  const onClassChange = () => {
    paintThemeColor()

    const html = document.documentElement
    const dark = html.classList.contains('dark')
    // our own add/remove of `theme-switching` also lands here: only a real mode
    // change starts the tween, or the cleanup would restart it forever
    if (dark === wasDark) return
    wasDark = dark
    html.classList.add('theme-switching')
    clearTimeout(switchTimer)
    switchTimer = setTimeout(() => html.classList.remove('theme-switching'), SWITCH_MS)
  }

  const title = () => {
    const key = route.meta.titleKey as string | undefined
    const brand = $i18n.t('brand')
    return key ? `${$i18n.t(key)} · ${brand}` : brand
  }
  const tagline = () => $i18n.t('auth.heroTitle')

  useHead({
    title,
    meta: [
      { name: 'theme-color', content: themeColor },

      // A shared link is previewed from these alone: absolute URLs, no relative paths.
      // The 1200×630 image is a static file, so it renders without a session.
      // og:title is the brand, not the page title: a crawler that opens any private page
      // is redirected to /login, so a "Masuk · " prefix is all it could ever add.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: () => $i18n.t('brand') },
      { property: 'og:title', content: () => $i18n.t('brand') },
      { property: 'og:description', content: tagline },
      { property: 'og:url', content: () => absolute(route.fullPath) },
      { property: 'og:locale', content: () => ($i18n.locale.value === 'id' ? 'id_ID' : 'en_US') },
      { property: 'og:image', content: absolute('/og.jpg') },
      { property: 'og:image:type', content: 'image/jpeg' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: tagline },
      // Telegram, Slack, iMessage and X read the twitter set when there is no card of their own
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: () => $i18n.t('brand') },
      { name: 'twitter:description', content: tagline },
      { name: 'twitter:image', content: absolute('/og.jpg') },
    ],
  })

  useNuxtApp().hook('app:mounted', () => {
    paintThemeColor()
    wasDark = document.documentElement.classList.contains('dark')
    // the colour mode swaps a class on <html>; nothing reactive announces it
    new MutationObserver(onClassChange).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })
})
