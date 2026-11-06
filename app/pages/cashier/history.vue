<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'history.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas'] })

const { locale, t } = useI18n()
const client = useSupabaseClient<Database>()
const { scopeRw } = await useMyScope()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }).format(v)} kg`
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))

const { search, rows, page, pageSize, total, loading, preset, fromDate, toDate } = useListPage({
  key: 'cashier-history',
  fetch: async ({ page, pageSize, term, from, to }) => {
    let q = client
      .from('deposits')
      .select('id,total_weight,total_value,deposited_at,status,resident:profiles!deposits_resident_id_fkey!inner(full_name,area:areas!profiles_area_id_fkey!inner(rw,rt))', { count: 'exact' })
    // a RW-bound operator only sees their own RW's weighings
    if (scopeRw.value) q = q.eq('resident.area.rw', scopeRw.value)
    if (term) q = q.ilike('resident.full_name', `%${term}%`)
    if (from) q = q.gte('deposited_at', from)
    if (to) q = q.lte('deposited_at', to)
    const { data, count } = await q.order('deposited_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
    return { rows: data ?? [], total: count ?? 0 }
  },
})

type Row = (typeof rows.value)[number]

const columns: TableColumn<Row>[] = [
  { accessorKey: 'deposited_at', header: () => t('resident.colDate') },
  { accessorKey: 'resident', header: () => t('history.colResident') },
  { accessorKey: 'total_weight', header: () => t('resident.colWeight') },
  { accessorKey: 'total_value', header: () => t('resident.colValue') },
  { accessorKey: 'status', header: () => t('common.status') },
  { id: 'actions' },
]

// ponytail: expanded state is keyed by row id; line items are fetched on first open
const expanded = ref<Record<string, boolean>>({})
const itemsCache = ref<Record<string, { name: string, weightKg: number, price: number, value: number }[]>>({})

async function toggle(row: Row) {
  const isOpen = !!expanded.value[row.id]
  expanded.value = { ...expanded.value, [row.id]: !isOpen }
  if (isOpen || itemsCache.value[row.id]) return
  const { data } = await client
    .from('deposit_items')
    .select('category_name,weight_kg,price_per_kg,value')
    .eq('deposit_id', row.id)
  // the line carries its own snapshot: renaming the master never rewrites a weighing
  itemsCache.value = {
    ...itemsCache.value,
    [row.id]: (data ?? []).map(i => ({
      name: i.category_name,
      weightKg: Number(i.weight_kg),
      price: Number(i.price_per_kg),
      value: Number(i.value),
    })),
  }
}

function residentLabel(resident: unknown) {
  const r = resident as { full_name: string, area: { rw: string, rt: string } | null } | null
  if (!r) return '-'
  const area = r.area ? ` · ${r.area.rw} · ${r.area.rt}` : ''
  return `${r.full_name}${area}`
}

const depositStatus = (s: string) => s === 'tercatat'
  ? { color: 'success' as const, label: t('dash.recorded') }
  : s === 'menunggu'
    ? { color: 'warning' as const, label: t('resident.pending') }
    : s === 'ditolak' || s === 'dibatalkan'
      ? { color: 'error' as const, label: t('resident.rejected') }
      : { color: 'neutral' as const, label: s }
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('history.title')" />
    </template>

    <template #body>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p class="text-sm text-muted">{{ $t('history.subtitle') }}</p>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('common.search')" class="w-full sm:w-56" />
          <DateRangeFilter v-model:preset="preset" v-model:from="fromDate" v-model:to="toDate" />
        </div>
      </div>

      <UTable v-model:expanded="expanded" :data="rows" :columns="columns" :loading="loading">
        <template #deposited_at-cell="{ row }">
          {{ fmtDate.format(new Date(row.original.deposited_at)) }}
        </template>
        <template #resident-cell="{ row }">
          {{ residentLabel(row.original.resident) }}
        </template>
        <template #total_weight-cell="{ row }">
          <span class="tabular-nums">{{ fmtKg(Number(row.original.total_weight)) }}</span>
        </template>
        <template #total_value-cell="{ row }">
          <span class="tabular-nums font-bold">{{ fmtRp.format(Number(row.original.total_value)) }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="depositStatus(row.original.status).color" variant="subtle">
            {{ depositStatus(row.original.status).label }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="expanded[row.original.id] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            :label="expanded[row.original.id] ? $t('history.hideDetail') : $t('history.showDetail')"
            @click="toggle(row.original)"
          />
        </template>
        <template #expanded="{ row }">
          <div class="border-t border-muted py-3">
            <p class="text-sm font-semibold mb-2">{{ $t('history.items') }}</p>
            <p v-if="!(itemsCache[row.original.id]?.length)" class="text-sm text-muted">{{ $t('common.empty') }}</p>
            <ul v-else class="grid gap-1 text-sm">
              <li v-for="(it, idx) in itemsCache[row.original.id]" :key="idx" class="flex flex-wrap items-center justify-between gap-2">
                <span>{{ it.name }} · <span class="tabular-nums">{{ fmtKg(it.weightKg) }}</span> · <span class="tabular-nums">{{ fmtRp.format(it.price) }}/kg</span></span>
                <span class="tabular-nums font-semibold">{{ fmtRp.format(it.value) }}</span>
              </li>
            </ul>
          </div>
        </template>
        <template #empty>
          <p class="text-sm text-muted py-6 text-center">{{ $t('common.empty') }}</p>
        </template>
      </UTable>

      <div v-if="total > pageSize" class="flex justify-end pt-4">
        <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" />
      </div>
    </template>
  </UDashboardPanel>
</template>
