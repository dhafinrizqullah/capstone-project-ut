<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas'] })

const { locale, t } = useI18n()
const myId = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))
const filter = ref('menunggu')

const { data: rows, status, refresh } = await useAsyncData('payouts', async () => {
  const { data } = await client
    .from('withdrawals')
    .select('id,resident_id,amount,status,created_at,resident:profiles!withdrawals_resident_id_fkey(full_name,rt)')
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}, { watch: [filter] })

// ponytail: push filtering into the query once data grows; small dataset so filter locally
const visible = computed(() => (rows.value ?? []).filter(r => filter.value === 'all' || r.status === filter.value))

type Row = NonNullable<typeof rows.value>[number]
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
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('payouts.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #right>
          <USelect
            v-model="filter"
            :items="[
              { label: $t('resident.pending'), value: 'menunggu' },
              { label: $t('resident.approved'), value: 'disetujui' },
              { label: $t('resident.rejected'), value: 'ditolak' },
              { label: $t('common.all'), value: 'all' },
            ]"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('payouts.subtitle') }}</p>
      <UTable :data="visible" :columns="columns" :loading="status === 'pending'">
        <template #resident-cell="{ row }">
          {{ (row.original.resident as unknown as { full_name: string, rt: string } | null)?.full_name ?? '-' }}
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
    </template>
  </UDashboardPanel>
</template>
