<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'payouts.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas'] })

const { locale, t } = useI18n()
const myId = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()
const { scopeRw } = await useMyScope()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))
const filter = ref('menunggu')

const { search, rows, page, pageSize, total, loading, refresh, preset, fromDate, toDate } = useListPage({
  key: 'payouts',
  // a status pick is a new result set, so it drives the refetch + page reset
  extra: [filter],
  fetch: async ({ page, pageSize, term, from, to }) => {
    let q = client
      .from('withdrawals')
      .select('id,resident_id,amount,status,created_at,resident:profiles!withdrawals_resident_id_fkey!inner(full_name,area:areas!profiles_area_id_fkey!inner(rw,rt))', { count: 'exact' })
    if (filter.value !== 'all') q = q.eq('status', filter.value)
    // search the resident name; `!inner` makes the filter drop non-matching requests
    if (term) q = q.ilike('resident.full_name', `%${term}%`)
    // a RW-bound operator only validates their own RW's requests
    if (scopeRw.value) q = q.eq('resident.area.rw', scopeRw.value)
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lte('created_at', to)
    const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
    return { rows: data ?? [], total: count ?? 0 }
  },
})

type Row = (typeof rows.value)[number]

const columns: TableColumn<Row>[] = [
  { accessorKey: 'resident', header: () => t('payouts.colResident') },
  { accessorKey: 'amount', header: () => t('payouts.colAmount') },
  { accessorKey: 'created_at', header: () => t('payouts.colDate') },
  { accessorKey: 'status', header: () => t('payouts.colStatus') },
  { id: 'actions' },
]

const acting = ref<string | null>(null)

async function decide(row: Row, approved: boolean) {
  acting.value = row.id
  const { error: upErr } = await client.from('withdrawals').update({
    status: approved ? 'disetujui' : 'ditolak',
    validated_by: myId,
    validated_at: new Date().toISOString(),
  }).eq('id', row.id)
  if (upErr) {
    acting.value = null
    toast.add({ title: upErr.message, color: 'error' })
    return
  }
  if (approved) {
    const { error: ledgerErr } = await client.from('savings_ledger').insert({
      resident_id: row.resident_id,
      type: 'debit',
      amount: Number(row.amount),
      reference: `withdrawal:${row.id}`,
    })
    if (ledgerErr) {
      acting.value = null
      toast.add({ title: ledgerErr.message, color: 'error' })
      return
    }
    toast.add({ title: t('payouts.approved'), color: 'success' })
  }
  else {
    toast.add({ title: t('payouts.rejected'), color: 'success' })
  }
  acting.value = null
  await refresh()
}

const statusColor = (s: string) => s === 'disetujui' ? 'success' : s === 'ditolak' ? 'error' : 'warning'

function residentLabel(resident: unknown) {
  const r = resident as { full_name: string, area: { rw: string, rt: string } | null } | null
  if (!r) return '-'
  const area = r.area ? ` · ${r.area.rw} · ${r.area.rt}` : ''
  return `${r.full_name}${area}`
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('payouts.title')" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p class="text-sm text-muted">{{ $t('payouts.subtitle') }}</p>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('common.search')" class="w-full sm:w-56" />
          <USelect
            v-model="filter"
            :items="[
              { label: $t('resident.pending'), value: 'menunggu' },
              { label: $t('resident.approved'), value: 'disetujui' },
              { label: $t('resident.rejected'), value: 'ditolak' },
              { label: $t('common.all'), value: 'all' },
            ]"
            class="w-full sm:w-40"
          />
          <DateRangeFilter v-model:preset="preset" v-model:from="fromDate" v-model:to="toDate" />
        </div>
      </div>
      <UTable :data="rows" :columns="columns" :loading="loading">
        <template #resident-cell="{ row }">
          {{ residentLabel(row.original.resident) }}
        </template>
        <template #amount-cell="{ row }">
          <span class="tabular-nums font-bold">{{ fmtRp.format(Number(row.original.amount)) }}</span>
        </template>
        <template #created_at-cell="{ row }">
          {{ fmtDate.format(new Date(row.original.created_at)) }}
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="statusColor(row.original.status)" variant="subtle">{{ row.original.status }}</UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div v-if="row.original.status === 'menunggu'" class="flex gap-1">
            <UButton
              size="xs"
              :label="$t('payouts.approve')"
              :loading="acting === row.original.id"
              @click="decide(row.original, true)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              :label="$t('payouts.reject')"
              :loading="acting === row.original.id"
              @click="decide(row.original, false)"
            />
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
