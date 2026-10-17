// Private page: Supabase session required, no content flash before redirect.
export default defineNuxtRouteMiddleware(() => {
  if (!useSupabaseUser().value) return navigateTo('/login')
})
