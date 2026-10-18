<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'resident.history', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['warga'] })

const { locale, t } = useI18n()
const uid = useMyId()
const client = useSupabaseClient<Database>()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }).format(v)} kg`
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }))

type Row = Pick<Database['public']['Tables']['deposits']['Row'], 'id' | 'total_weight' | 'total_value' | 'deposited_at' | 'status'>

const { rows, total, page, pageSize, loading, preset, fromDate, toDate } = useListPage<Row>({
  key: 'resident-weighings',
  fetch: async ({ page, pageSize, from, to }) => {
    let q = client
      .from('deposits')
      .select('id,total_weight,total_value,deposited_at,status', { count: 'exact' })
      .eq('resident_id', uid)
    if (from) q = q.gte('deposited_at', from)
    if (to) q = q.lte('deposited_at', to)
    // no search box here: a resident's own rows are few enough to page through
    const { data, count } = await q.order('deposited_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
    return { rows: data ?? [], total: count ?? 0 }
  },
})

const columns: TableColumn<Row>[] = [
  { accessorKey: 'deposited_at', header: () => t('resident.colDate') },
  { accessorKey: 'total_weight', header: () => t('resident.colWeight') },
  { accessorKey: 'total_value', header: () => t('resident.colValue') },
  { accessorKey: 'status', header: () => t('resident.colStatus') },
]

const depositStatus = (s: string) => s === 'tercatat'
  ? { color: 'success' as const, label: t('dash.recorded') }
  : s === 'menunggu'
    ? { color: 'warning' as const, label: t('resident.pending') }
    : { color: 'error' as const, label: t('resident.rejected') }
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('resident.history')" />
    </template>

    <template #body>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p class="text-sm text-muted">{{ $t('resident.weighingsSubtitle') }}</p>
        <DateRangeFilter v-model:preset="preset" v-model:from="fromDate" v-model:to="toDate" />
      </div>

      <UTable :data="rows" :columns="columns" :loading="loading">
        <template #deposited_at-cell="{ row }">
          {{ fmtDate.format(new Date(row.original.deposited_at)) }}
        </template>
        <template #total_weight-cell="{ row }">
          <span class="tabular-nums">{{ fmtKg(Number(row.original.total_weight)) }}</span>
        </template>
        <template #total_value-cell="{ row }">
          <span class="tabular-nums">{{ fmtRp.format(Number(row.original.total_value)) }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="depositStatus(row.original.status).color" variant="subtle">
            {{ depositStatus(row.original.status).label }}
          </UBadge>
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
