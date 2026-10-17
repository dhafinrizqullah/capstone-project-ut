<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['superadmin'] })

const { t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

const { data: rows, refresh } = await useAsyncData('admin-users', async () => {
  const { data } = await client
    .from('profiles')
    .select('id,full_name,email,role,area:areas!profiles_area_id_fkey(rw,rt)')
    .order('created_at', { ascending: false })
    .limit(100)
  return (data ?? []).map(r => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    role: r.role,
    rw: (r.area as unknown as { rw: string, rt: string } | null)?.rw ?? null,
    rt: (r.area as unknown as { rw: string, rt: string } | null)?.rt ?? null,
  }))
})

// ponytail: area master from the areas table; RT options scoped to chosen RW

type Row = NonNullable<typeof rows.value>[number]
const columns: TableColumn<Row>[] = [
  { accessorKey: 'full_name', header: () => t('users.colName') },
  { accessorKey: 'email', header: () => t('users.colEmail') },
  { accessorKey: 'role', header: () => t('users.colRole') },
  { accessorKey: 'rw', header: () => t('users.colRw') },
  { accessorKey: 'rt', header: () => t('users.colRt') },
]

const search = ref('')
const page = ref(1)
const pageSize = 10

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = rows.value ?? []
  if (!q) return list
  return list.filter(r =>
    r.full_name.toLowerCase().includes(q)
    || r.email.toLowerCase().includes(q)
    || roleLabel(r.role).toLowerCase().includes(q),
  )
})
const total = computed(() => filtered.value.length)
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch(search, () => { page.value = 1 })

const roleLabel = (r: string) => ({
  warga: t('users.roleWarga'),
  petugas: t('users.rolePetugas'),
  pengepul: t('users.rolePengepul'),
  pengurus_rw: t('users.rolePengurus'),
  superadmin: t('users.roleSuperadmin'),
}[r] ?? r)

const schema = z.object({
  full_name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(['warga', 'petugas', 'pengepul', 'pengurus_rw', 'superadmin']),
  rt: z.string().optional(),
  rw: z.string().min(1).default('RW 05'),
})
type Schema = z.output<typeof schema>
const state = reactive<Partial<Schema>>({ full_name: '', email: '', password: '', role: 'warga', rt: '', rw: 'RW 05' })
const creating = ref(false)

// ponytail: RW/RT pickers read the areas master; RT scoped to chosen RW, custom values allowed
const { data: areas } = await useAsyncData('admin-areas', async () => {
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

const roleItems = computed(() => (['warga', 'petugas', 'pengepul', 'pengurus_rw', 'superadmin'] as const)
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
      <UDashboardNavbar :title="$t('users.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
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
            <UFormField name="rw" :label="$t('users.colRw')" required>
              <UInputMenu v-model="state.rw" :items="rwOptions" create-item class="w-full" />
            </UFormField>
            <UFormField v-if="state.role === 'warga'" name="rt" :label="$t('users.rt')">
              <UInputMenu v-model="state.rt" :items="rtSuggestions" create-item class="w-full" />
            </UFormField>
            <UButton type="submit" :loading="creating" :label="$t('users.create')" block />
          </UForm>
        </UCard>

        <UCard>
          <div class="flex justify-end mb-3">
            <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('common.search')" class="w-full sm:w-64" />
          </div>
          <UTable :data="paged" :columns="columns">
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
          <div class="flex justify-end pt-4">
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" />
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
