// Halaman privat: butuh sesi Supabase, tanpa kilatan konten sebelum redirect.
export default defineNuxtRouteMiddleware(() => {
  if (!useSupabaseUser().value) return navigateTo('/login')
})
