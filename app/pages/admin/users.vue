<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'users.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['superadmin'] })

const { t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

type Row = {
  id: string
  full_name: string
  email: string
  role: string
  rw: string | null
  rt: string | null
}

const { search, rows, page, pageSize, total, refresh } = useListPage<Row>({
  key: 'admin-users',
  fetch: async ({ page, pageSize, term }) => {
    let q = client
      .from('profiles')
      .select('id,full_name,email,role,rw,area:areas!profiles_area_id_fkey(rw,rt)', { count: 'exact' })
    if (term) {
      // search the stored values, not the localised role labels
      const pattern = likePattern(term)
      q = q.or(`full_name.ilike.${pattern},email.ilike.${pattern},role.ilike.${pattern}`)
    }
    const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
    return {
      rows: (data ?? []).map(r => ({
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        role: r.role,
        // residents carry their RW on the area; RW-bound staff carry it on the profile
        rw: (r.area as unknown as { rw: string, rt: string } | null)?.rw ?? r.rw ?? null,
        rt: (r.area as unknown as { rw: string, rt: string } | null)?.rt ?? null,
      })),
      total: count ?? 0,
    }
  },
})
const columns: TableColumn<Row>[] = [
  { accessorKey: 'full_name', header: () => t('users.colName') },
  { accessorKey: 'email', header: () => t('users.colEmail') },
  { accessorKey: 'role', header: () => t('users.colRole') },
  { accessorKey: 'rw', header: () => t('users.colRw') },
  { accessorKey: 'rt', header: () => t('users.colRt') },
]

const roleLabel = (r: string) => ({
  warga: t('users.roleWarga'),
  petugas: t('users.rolePetugas'),
  pengepul: t('users.rolePengepul'),
  pengurus_rw: t('users.rolePengurus'),
  superadmin: t('users.roleSuperadmin'),
}[r] ?? r)

// ponytail: no superadmin here — the backend rejects it too. Roles differ in how
// they are scoped: residents by area (RW + RT), RW-bound staff by RW only.
const RW_BOUND = ['petugas', 'pengurus_rw']
const schema = z.object({
  full_name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(['warga', 'petugas', 'pengepul', 'pengurus_rw']),
  rt: z.string().optional(),
  rw: z.string().optional(),
}).refine(d => d.role !== 'warga' || (!!d.rw && !!d.rt), {
  path: ['rt'],
  message: () => t('users.rtRequired'),
}).refine(d => !RW_BOUND.includes(d.role) || !!d.rw, {
  path: ['rw'],
  message: () => t('users.rwRequired'),
})
type Schema = z.output<typeof schema>
const state = reactive<Partial<Schema>>({ full_name: '', email: '', password: '', role: 'warga', rt: '', rw: 'RW 05' })
const creating = ref(false)

// ponytail: RW/RT pickers read the areas master; RT scoped to chosen RW, custom values allowed
const { data: areas } = await useAsyncData('admin-area-options', async () => {
  const { data } = await client.from('areas').select('rw,rt').order('rw').order('rt')
  return data ?? []
})
const rwOptions = computed(() => {
  const list = [...new Set((areas.value ?? []).map(a => a.rw))].sort()
  return list.length ? list : ['RW 05']
})
const rtSuggestions = computed(() => {
  const pool = (areas.value ?? []).filter(a => !state.rw || a.rw === state.rw)
  const list = [...new Set(pool.map(a => a.rt))].sort()
  return list.length ? list : ['RT 01', 'RT 02', 'RT 03']
})
watch(() => state.rw, () => {
  if (state.rt && !rtSuggestions.value.includes(state.rt)) state.rt = ''
})

const roleItems = computed(() => (['warga', 'petugas', 'pengepul', 'pengurus_rw'] as const)
  .map(v => ({ label: roleLabel(v), value: v })))

async function onCreate(event: FormSubmitEvent<Schema>) {
  creating.value = true
  try {
    const res = await $fetch<{ email: string }>('/api/admin/users', { method: 'POST', body: event.data })
    Object.assign(state, { full_name: '', email: '', password: '', role: 'warga', rt: '', rw: 'RW 05' })
    toast.add({ title: t('users.created', { email: res.email }), color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: (e as Error).message, color: 'error' })
  }
  creating.value = false
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('users.title')" />
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('users.subtitle') }}</p>

      <div class="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <UCard>
          <UForm :schema="schema" :state="state" class="space-y-3" @submit="onCreate">
            <UFormField name="full_name" :label="$t('users.name')" required>
              <UInput v-model="state.full_name" class="w-full" />
            </UFormField>
            <UFormField name="email" :label="$t('users.email')" required>
              <UInput v-model="state.email" type="email" :spellcheck="false" class="w-full" />
            </UFormField>
            <UFormField name="password" :label="$t('users.password')" required>
              <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
            </UFormField>
            <UFormField name="role" :label="$t('users.role')" required>
              <USelect v-model="state.role" :items="roleItems" value-key="value" class="w-full" />
            </UFormField>
            <div v-if="state.role === 'warga'" class="grid gap-3 sm:grid-cols-2">
              <UFormField name="rw" :label="$t('users.colRw')" required>
                <UInputMenu v-model="state.rw" :items="rwOptions" create-item class="w-full" />
              </UFormField>
              <UFormField name="rt" :label="$t('users.rt')" required>
                <UInputMenu v-model="state.rt" :items="rtSuggestions" create-item class="w-full" />
              </UFormField>
            </div>
            <UFormField v-else-if="RW_BOUND.includes(state.role ?? '')" name="rw" :label="$t('users.colRw')" required>
              <UInputMenu v-model="state.rw" :items="rwOptions" create-item class="w-full" />
            </UFormField>
            <UButton type="submit" :loading="creating" :label="$t('users.create')" block />
          </UForm>
        </UCard>

        <UCard>
          <div class="flex justify-end mb-3">
            <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('common.search')" class="w-full sm:w-64" />
          </div>
          <UTable :data="rows" :columns="columns">
            <template #role-cell="{ row }">
              <UBadge color="neutral" variant="subtle">{{ roleLabel(row.original.role) }}</UBadge>
            </template>
            <template #rt-cell="{ row }">
              {{ row.original.rt ?? '-' }}
            </template>
            <template #empty>
              <p class="text-sm text-muted py-6 text-center">{{ $t('common.empty') }}</p>
            </template>
          </UTable>
          <div v-if="total > pageSize" class="flex justify-end pt-4">
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" />
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
