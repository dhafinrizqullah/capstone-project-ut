/**
 * Head concerns that depend on the route, the locale, or the colour mode.
 *
 * - Title: "<page title> · <brand>", in the active locale. A page opts in with
 *   `definePageMeta({ titleKey: '<i18n key>' })`; without one the title is just
 *   the brand, so a new page is never title-less.
 * - Theme colour: the mobile browser chrome follows the painted background,
 *   including when the user overrides the OS preference from the sidebar.
 */
export default defineNuxtPlugin(() => {
  const route = useRoute()
  const { $i18n } = useNuxtApp()
  const themeColor = ref('')

  const paintThemeColor = () => {
    const html = document.documentElement
    const bg = getComputedStyle(html).getPropertyValue('--ui-bg').trim()
    themeColor.value = bg || (html.classList.contains('dark') ? '#0f172a' : '#ffffff')
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
    // colour-mode swaps a class on <html>; nothing reactive announces it
    new MutationObserver(paintThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })
})
