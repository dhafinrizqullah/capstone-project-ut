<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'ship.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas'] })

const { locale, t } = useI18n()
const myId = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }).format(v)} kg`
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))

const { data: refs } = await useAsyncData('ship-refs', async () => {
  const [collectors, cats] = await Promise.all([
    client.from('profiles').select('id,full_name').eq('role', 'pengepul').order('full_name'),
    client.from('waste_categories').select('id,name,price_per_kg').eq('active', true).order('name'),
  ])
  return { collectors: collectors.data ?? [], cats: cats.data ?? [] }
})

const { search, rows, page, pageSize, total, loading, refresh, preset, fromDate, toDate } = useListPage({
  key: 'shipments',
  fetch: async ({ page, pageSize, term, from, to }) => {
    let q = client.from('shipments').select('id,note_number,total_weight,total_value,status,shipped_at', { count: 'exact' })
    if (term) q = q.ilike('note_number', `%${term}%`)
    if (from) q = q.gte('shipped_at', from)
    if (to) q = q.lte('shipped_at', to)
    const { data, count } = await q.order('shipped_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
    return { rows: data ?? [], total: count ?? 0 }
  },
})

type Row = (typeof rows.value)[number]
const columns: TableColumn<Row>[] = [
  { accessorKey: 'note_number', header: () => t('handover.note') },
  { accessorKey: 'shipped_at', header: () => t('handover.date') },
  { accessorKey: 'total_weight', header: () => t('handover.weight') },
  { accessorKey: 'total_value', header: () => t('handover.value') },
  { accessorKey: 'status', header: () => t('common.status') },
]

const collectorId = ref<string>()
const categoryId = ref<number>()
// ponytail: text + parseWeightKg, not a number field — see the cashier page
const weightText = ref('')
const weightKg = computed(() => parseWeightKg(weightText.value))
const items = ref<{ categoryId: number, name: string, weightKg: number, price: number, value: number }[]>([])
const saving = ref(false)

const collectorItems = computed(() => (refs.value?.collectors ?? []).map(c => ({ label: c.full_name, value: c.id })))
const categoryItems = computed(() => (refs.value?.cats ?? []).map(c => ({ label: `${c.name} · ${fmtRp.value.format(Number(c.price_per_kg))}/kg`, value: c.id })))
const totalValue = computed(() => items.value.reduce((s, i) => s + i.value, 0))
const totalKg = computed(() => items.value.reduce((s, i) => s + i.weightKg, 0))

function addItem() {
  const cat = (refs.value?.cats ?? []).find(c => c.id === categoryId.value)
  if (!cat) return
  if (!weightKg.value) {
    toast.add({ title: t('cashier.needWeight'), color: 'warning' })
    return
  }
  const price = Number(cat.price_per_kg)
  items.value.push({ categoryId: cat.id, name: cat.name, weightKg: weightKg.value, price, value: Math.round(weightKg.value * price) })
  categoryId.value = undefined
  weightText.value = ''
}

async function submit() {
  if (!collectorId.value) {
    toast.add({ title: t('ship.needCollector'), color: 'warning' })
    return
  }
  if (!items.value.length) {
    toast.add({ title: t('ship.needItem'), color: 'warning' })
    return
  }
  saving.value = true
  const { data: ship, error: shipErr } = await client.from('shipments').insert({
    collector_id: collectorId.value,
    operator_id: myId,
    total_weight: totalKg.value,
    total_value: totalValue.value,
  }).select('id,note_number').single()
  if (shipErr || !ship) {
    saving.value = false
    toast.add({ title: shipErr?.message ?? 'Error', color: 'error' })
    return
  }
  const { error: itemsErr } = await client.from('shipment_items').insert(
    items.value.map(i => ({ shipment_id: ship.id, category_id: i.categoryId, category_name: i.name, weight_kg: i.weightKg, price_per_kg: i.price, value: i.value })),
  )
  saving.value = false
  if (itemsErr) {
    toast.add({ title: itemsErr.message, color: 'error' })
    return
  }
  items.value = []
  collectorId.value = undefined
  toast.add({ title: t('ship.issued', { note: ship.note_number }), color: 'success' })
  await refresh()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('ship.title')" />
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('ship.subtitle') }}</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <UCard>
          <div class="grid gap-4">
            <UFormField name="collector" :label="$t('ship.collector')" required>
              <USelectMenu
                v-model="collectorId"
                value-key="value"
                :items="collectorItems"
                :placeholder="$t('ship.pickCollector')"
                searchable
                class="w-full"
              />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-[1fr_130px_auto] gap-2 sm:items-end">
              <UFormField name="category" :label="$t('ship.category')">
                <USelectMenu
                  v-model="categoryId"
                  value-key="value"
                  :items="categoryItems"
                  :placeholder="$t('ship.category')"
                  searchable
                  class="w-full"
                />
              </UFormField>
              <UFormField name="weight" :label="$t('ship.weightKg')">
                <UInput v-model="weightText" inputmode="decimal" :placeholder="$t('cashier.weightPlaceholder')" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-plus" :label="$t('ship.addItem')" @click="addItem" />
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-bold">{{ $t('ship.total') }}</h2>
              <span class="text-xl font-extrabold tabular-nums">{{ fmtRp.format(totalValue) }}</span>
            </div>
          </template>
          <p v-if="!items.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
          <ul v-else class="grid gap-2 mb-4">
            <li v-for="(it, idx) in items" :key="idx" class="flex items-center justify-between gap-2 text-sm">
              <span>{{ it.name }} · <span class="tabular-nums">{{ fmtKg(it.weightKg) }}</span></span>
              <span class="flex items-center gap-2">
                <span class="font-bold tabular-nums">{{ fmtRp.format(it.value) }}</span>
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="it.name" @click="items.splice(idx, 1)" />
              </span>
            </li>
          </ul>
          <UButton :label="$t('ship.submit')" :loading="saving" :disabled="!items.length" block size="lg" @click="submit" />
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="font-bold">{{ $t('ship.history') }}</h2>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('common.search')" class="w-full sm:w-56" />
              <DateRangeFilter v-model:preset="preset" v-model:from="fromDate" v-model:to="toDate" />
            </div>
          </div>
        </template>
        <UTable :data="rows" :columns="columns" :loading="loading">
          <template #shipped_at-cell="{ row }">
            {{ fmtDate.format(new Date(row.original.shipped_at)) }}
          </template>
          <template #total_weight-cell="{ row }">
            <span class="tabular-nums">{{ fmtKg(Number(row.original.total_weight)) }}</span>
          </template>
          <template #total_value-cell="{ row }">
            <span class="tabular-nums">{{ fmtRp.format(Number(row.original.total_value)) }}</span>
          </template>
          <template #status-cell="{ row }">
            <UBadge :color="row.original.status === 'diterima' ? 'success' : 'warning'" variant="subtle">
              {{ row.original.status === 'diterima' ? $t('handover.received') : $t('handover.sent') }}
            </UBadge>
          </template>
          <template #empty>
            <p class="text-sm text-muted py-6 text-center">{{ $t('common.empty') }}</p>
          </template>
        </UTable>
        <div v-if="total > pageSize" class="flex justify-end pt-4">
          <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" />
        </div>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
