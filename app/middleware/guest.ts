// Public page (login): signed-in users bounce straight to the dashboard.
export default defineNuxtRouteMiddleware(() => {
  if (useSupabaseUser().value) return navigateTo('/')
})
