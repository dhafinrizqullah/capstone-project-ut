import type { Database } from '~/types/database.types'

// ponytail: peta home per peran — satu-satunya tempat mapping terpusat
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

  // ponytail: useSupabaseUser berisi JWT claims (bukan objek user) — id ada di `sub`
  const uid = (user.value as unknown as { sub: string }).sub
  if (!uid) return navigateTo('/login')

  const client = useSupabaseClient<Database>()
  const { data } = await client
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle()

  if (!data || !allowed.includes(data.role)) {
    return navigateTo(data ? (HOME_BY_ROLE[data.role] ?? '/login') : '/login')
  }
})
