<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['superadmin'] })

const { t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

const { data: rows, refresh } = await useAsyncData('admin-users', async () => {
  const { data } = await client.from('profiles').select('id,full_name,email,role,rt,rw').order('created_at', { ascending: false }).limit(100)
  return data ?? []
})

// ponytail: area suggestions come from existing data, but new RW/RT can be typed
const { data: areas } = await useAsyncData('admin-areas', async () => {
  const { data } = await client.from('profiles').select('rt,rw').limit(500)
  const rws = [...new Set((data ?? []).map(p => p.rw).filter(Boolean))].sort() as string[]
  const rts = [...new Set((data ?? []).map(p => p.rt).filter(Boolean))].sort() as string[]
  return { rws: rws.length ? rws : ['RW 05'], rts: rts.length ? rts : ['RT 01', 'RT 02', 'RT 03'] }
})

type Row = NonNullable<typeof rows.value>[number]
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
              <UInputMenu v-model="state.rw" :items="areas?.rws ?? []" create-item class="w-full" />
            </UFormField>
            <UFormField v-if="state.role === 'warga'" name="rt" :label="$t('users.rt')">
              <UInputMenu v-model="state.rt" :items="areas?.rts ?? []" create-item class="w-full" />
            </UFormField>
            <UButton type="submit" :loading="creating" :label="$t('users.create')" block />
          </UForm>
        </UCard>

        <UCard>
          <UTable :data="rows ?? []" :columns="columns">
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
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
