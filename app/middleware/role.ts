import type { Database } from '~/types/database.types'

// ponytail: central role-home map — single source of truth
export const HOME_BY_ROLE: Record<string, string> = {
  warga: '/resident',
  petugas: '/cashier',
  pengepul: '/handover',
  pengurus_rw: '/',
  superadmin: '/admin/users',
}

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  const allowed = (to.meta.allowedRoles ?? []) as string[]
  if (!allowed.length) return

  // ponytail: useSupabaseUser holds JWT claims (not the user object) — id lives in `sub`
  const uid = (user.value as unknown as { sub: string }).sub
  if (!uid) return navigateTo('/login')

  const client = useSupabaseClient<Database>()
  const { data } = await client
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle()

  if (!data || !allowed.includes(data.role)) {
    // ponytail: superadmin passes every role gate (checked again: role came from profiles, not client input)
    if (data?.role === 'superadmin') return
    return navigateTo(data ? (HOME_BY_ROLE[data.role] ?? '/login') : '/login')
  }
})
