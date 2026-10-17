/**
 * Document title: "<page title> · <brand>", in the active locale. A page opts in
 * with `definePageMeta({ titleKey: '<i18n key>' })`; without one the title is
 * just the brand, so a new page is never title-less.
 */
export default defineNuxtPlugin(() => {
  const route = useRoute()
  const { $i18n } = useNuxtApp()

  useHead({
    title: () => {
      const key = route.meta.titleKey as string | undefined
      const brand = $i18n.t('brand')
      return key ? `${$i18n.t(key)} · ${brand}` : brand
    },
  })
})
