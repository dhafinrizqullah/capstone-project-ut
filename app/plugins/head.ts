/**
 * Head concerns that depend on the route, the locale, or the colour mode, plus
 * the two things a mode flip has to keep in sync: the browser chrome colour and
 * the transition that makes the swap smooth.
 *
 * - Title: "<page title> · <brand>", in the active locale. A page opts in with
 *   `definePageMeta({ titleKey: '<i18n key>' })`; without one the title is just
 *   the brand, so a new page is never title-less.
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

  useHead({
    title: () => {
      const key = route.meta.titleKey as string | undefined
      const brand = $i18n.t('brand')
      return key ? `${$i18n.t(key)} · ${brand}` : brand
    },
    meta: [{ name: 'theme-color', content: themeColor }],
  })

  useNuxtApp().hook('app:mounted', () => {
    paintThemeColor()
    wasDark = document.documentElement.classList.contains('dark')
    // the colour mode swaps a class on <html>; nothing reactive announces it
    new MutationObserver(onClassChange).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })
})
