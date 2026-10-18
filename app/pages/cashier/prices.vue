<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'prices.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas', 'pengurus_rw'] })

const { locale, t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))

type Row = Pick<Database['public']['Tables']['waste_categories']['Row'], 'id' | 'name' | 'price_per_kg' | 'active'>

const { search, rows, page, pageSize, total, loading, refresh } = useListPage<Row>({
  key: 'prices',
  fetch: async ({ page, pageSize, term }) => {
    let q = client.from('waste_categories').select('id,name,price_per_kg,active', { count: 'exact' })
    if (term) q = q.ilike('name', `%${term}%`)
    const { data, count } = await q.order('name').range((page - 1) * pageSize, page * pageSize - 1)
    return { rows: data ?? [], total: count ?? 0 }
  },
})
const columns: TableColumn<Row>[] = [
  { accessorKey: 'name', header: () => t('prices.colName') },
  { accessorKey: 'price_per_kg', header: () => t('prices.colPrice') },
  { accessorKey: 'active', header: () => t('prices.colActive') },
  { id: 'actions' },
]

const open = ref(false)
const editing = ref<Row | null>(null)
const schema = z.object({
  name: z.string().min(1),
  price_per_kg: z.number().min(0),
  active: z.boolean(),
})
type Schema = z.output<typeof schema>
const state = reactive<Schema>({ name: '', price_per_kg: 0, active: true })

function openNew() {
  editing.value = null
  Object.assign(state, { name: '', price_per_kg: 0, active: true })
  open.value = true
}

function openEdit(row: Row) {
  editing.value = row
  Object.assign(state, { name: row.name, price_per_kg: Number(row.price_per_kg), active: row.active })
  open.value = true
}

async function onSave(event: FormSubmitEvent<Schema>) {
  if (editing.value) {
    const { error } = await client.from('waste_categories').update(event.data).eq('id', editing.value.id)
    if (error) {
      toast.add({ title: error.message, color: 'error' })
      return
    }
  }
  else {
    const { error } = await client.from('waste_categories').insert(event.data)
    if (error) {
      toast.add({ title: error.message, color: 'error' })
      return
    }
  }
  open.value = false
  toast.add({ title: t('prices.saved'), color: 'success' })
  await refresh()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('prices.title')" />
    </template>

    <template #body>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p class="text-sm text-muted">{{ $t('prices.subtitle') }}</p>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('common.search')" class="w-full sm:w-56" />
          <UButton class="self-start sm:self-auto" icon="i-lucide-plus" :label="$t('prices.new')" @click="openNew" />
        </div>
      </div>
      <UTable :data="rows" :columns="columns" :loading="loading">
        <template #price_per_kg-cell="{ row }">
          <span class="tabular-nums">{{ fmtRp.format(Number(row.original.price_per_kg)) }}</span>
        </template>
        <template #active-cell="{ row }">
          <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
            {{ row.original.active ? $t('prices.yes') : $t('prices.no') }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" :aria-label="t('prices.edit')" @click="openEdit(row.original)" />
        </template>
        <template #empty>
          <p class="text-sm text-muted py-6 text-center">{{ $t('common.empty') }}</p>
        </template>
      </UTable>
      <div v-if="total > pageSize" class="flex justify-end pt-4">
        <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" />
      </div>

      <UModal v-model:open="open" :title="editing ? $t('prices.edit') : $t('prices.new')">
        <template #body>
          <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSave">
            <UFormField name="name" :label="$t('prices.name')" required>
              <UInput v-model="state.name" class="w-full" />
            </UFormField>
            <UFormField name="price_per_kg" :label="$t('prices.price')" required>
              <UInputNumber v-model="state.price_per_kg" :min="0" :step="500" :step-snapping="false" class="w-full" />
            </UFormField>
            <UFormField name="active" :label="$t('prices.active')">
              <USwitch v-model="state.active" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton :label="$t('common.cancel')" color="neutral" variant="outline" @click="open = false" />
              <UButton type="submit" :label="$t('prices.save')" />
            </div>
          </UForm>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
