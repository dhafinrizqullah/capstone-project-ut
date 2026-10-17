import type { Database } from '~/types/database.types'

/**
 * The signed-in user's data scope. `scopeRw` is the RW that limits which rows
 * they may see: set for the RW-bound staff roles (petugas, pengurus_rw), null
 * for everyone else (superadmin sees all, pengepul is collector-scoped).
 *
 * ponytail: scope is applied in queries/UI — RLS stays role-based, so per-RW
 * isolation at the database is still out of scope (as the areas migration notes).
 * A null `scopeRw` therefore means "no filter", not "no data".
 */
export async function useMyScope() {
  const client = useSupabaseClient<Database>()
  const { data } = await useAsyncData('my-scope', async () => {
    const { data } = await client
      .from('profiles')
      .select('role,rw')
      .eq('id', useMyId())
      .maybeSingle()
    return data
  })

  const role = computed(() => data.value?.role ?? null)
  const scopeRw = computed(() => {
    const r = role.value
    return r === 'petugas' || r === 'pengurus_rw' ? data.value?.rw ?? null : null
  })

  return { role, scopeRw }
}
