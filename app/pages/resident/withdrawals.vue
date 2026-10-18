<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'resident.withdrawHistory', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['warga'] })

const { locale, t } = useI18n()
const uid = useMyId()
const client = useSupabaseClient<Database>()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }))

type Row = Pick<Database['public']['Tables']['withdrawals']['Row'], 'id' | 'amount' | 'status' | 'created_at'>

const { rows, total, page, pageSize, loading, preset, fromDate, toDate } = useListPage<Row>({
  key: 'resident-withdrawals',
  fetch: async ({ page, pageSize, from, to }) => {
    let q = client
      .from('withdrawals')
      .select('id,amount,status,created_at', { count: 'exact' })
      .eq('resident_id', uid)
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lte('created_at', to)
    const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
    return { rows: data ?? [], total: count ?? 0 }
  },
})

const columns: TableColumn<Row>[] = [
  { accessorKey: 'created_at', header: () => t('resident.colDate') },
  { accessorKey: 'amount', header: () => t('resident.colAmount') },
  { accessorKey: 'status', header: () => t('resident.colStatus') },
]

const statusColor = (s: string) => s === 'disetujui' ? 'success' : s === 'ditolak' ? 'error' : 'warning'
const statusLabel = (s: string) => s === 'disetujui' ? t('resident.approved') : s === 'ditolak' ? t('resident.rejected') : t('resident.pending')
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('resident.withdrawHistory')" />
    </template>

    <template #body>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p class="text-sm text-muted">{{ $t('resident.withdrawalsSubtitle') }}</p>
        <DateRangeFilter v-model:preset="preset" v-model:from="fromDate" v-model:to="toDate" />
      </div>

      <UTable :data="rows" :columns="columns" :loading="loading">
        <template #created_at-cell="{ row }">
          {{ fmtDate.format(new Date(row.original.created_at)) }}
        </template>
        <template #amount-cell="{ row }">
          <span class="tabular-nums font-bold">{{ fmtRp.format(Number(row.original.amount)) }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="statusColor(row.original.status)" variant="subtle">{{ statusLabel(row.original.status) }}</UBadge>
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
