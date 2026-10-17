// Halaman publik (login): yang sudah masuk langsung dilempar ke dasbor.
export default defineNuxtRouteMiddleware(() => {
  if (useSupabaseUser().value) return navigateTo('/')
})
