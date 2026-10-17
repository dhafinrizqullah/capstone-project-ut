<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas', 'pengurus_rw'] })

const { locale, t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))

const { data: rows, refresh } = await useAsyncData('prices', async () => {
  const { data } = await client.from('waste_categories').select('id,name,price_per_kg,active').order('name')
  return data ?? []
})

const { data: myRole } = await useAsyncData('prices-role', async () => {
  const { data } = await client.from('profiles').select('role').eq('id', useMyId()).maybeSingle()
  return data?.role ?? null
})
const canDelete = computed(() => myRole.value === 'pengurus_rw' || myRole.value === 'superadmin')

const { data: areaRows, refresh: refreshAreas } = await useAsyncData('areas', async () => {
  const { data } = await client.from('areas').select('id,rw,rt').order('rw').order('rt')
  return data ?? []
})
const newRw = ref('')
const newRt = ref('')
const savingArea = ref(false)

async function addArea() {
  if (!newRw.value.trim() || !newRt.value.trim()) return
  savingArea.value = true
  const { error } = await client.from('areas').insert({ rw: newRw.value.trim(), rt: newRt.value.trim() })
  savingArea.value = false
  if (error) {
    toast.add({ title: error.code === '23505' ? `${newRw.value} · ${newRt.value}` : error.message, color: 'error' })
    return
  }
  newRw.value = ''
  newRt.value = ''
  toast.add({ title: t('areas.saved'), color: 'success' })
  await refreshAreas()
}

async function deleteArea(id: number) {
  const { error } = await client.from('areas').delete().eq('id', id)
  if (error) {
    toast.add({ title: error.code === '23503' ? t('areas.inUse') : error.message, color: 'error' })
    return
  }
  toast.add({ title: t('areas.deleted'), color: 'success' })
  await refreshAreas()
}

type Row = NonNullable<typeof rows.value>[number]
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
      <UDashboardNavbar :title="$t('prices.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" :label="$t('prices.new')" @click="openNew" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('prices.subtitle') }}</p>
      <UTable :data="rows ?? []" :columns="columns">
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

      <UModal v-model:open="open" :title="editing ? $t('prices.edit') : $t('prices.new')">
        <template #body>
          <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSave">
            <UFormField name="name" :label="$t('prices.name')" required>
              <UInput v-model="state.name" class="w-full" />
            </UFormField>
            <UFormField name="price_per_kg" :label="$t('prices.price')" required>
              <UInputNumber v-model="state.price_per_kg" :min="0" :step="500" class="w-full" />
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

      <UCard class="mt-4">
        <template #header>
          <h2 class="font-bold">{{ $t('areas.title') }}</h2>
          <p class="text-sm text-muted">{{ $t('areas.subtitle') }}</p>
        </template>
        <div class="grid grid-cols-[1fr_1fr_auto] gap-2 items-end mb-3">
          <UFormField name="newRw" :label="$t('areas.rw')">
            <UInput v-model="newRw" placeholder="RW 05…" class="w-full" />
          </UFormField>
          <UFormField name="newRt" :label="$t('areas.rt')">
            <UInput v-model="newRt" placeholder="RT 01…" class="w-full" />
          </UFormField>
          <UButton icon="i-lucide-plus" :label="$t('areas.add')" :loading="savingArea" @click="addArea" />
        </div>
        <ul class="grid gap-1">
          <li v-for="a in areaRows ?? []" :key="a.id" class="flex items-center justify-between gap-2 text-sm py-1.5 border-t border-muted">
            <span class="font-semibold">{{ a.rw }} · {{ a.rt }}</span>
            <UButton
              v-if="canDelete"
              icon="i-lucide-trash"
              color="error"
              variant="ghost"
              size="xs"
              :aria-label="`${a.rw} ${a.rt}`"
              @click="deleteArea(a.id)"
            />
          </li>
        </ul>
        <p v-if="!areaRows?.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
