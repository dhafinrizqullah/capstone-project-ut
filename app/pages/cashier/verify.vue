<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'verify.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas'] })

const { locale, t } = useI18n()
const myId = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()
const { scopeRw } = await useMyScope()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }).format(v)} kg`
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))

const { data: rows, status, refresh } = await useAsyncData('verify-deposits', async () => {
  const { data } = await client
    .from('deposits')
    .select('id,resident_id,estimated_weight,deposited_at,items:deposit_items(id,category_name,weight_kg,price_per_kg),resident:profiles!deposits_resident_id_fkey(full_name,area:areas!profiles_area_id_fkey(rw,rt))')
    .eq('status', 'menunggu')
    .order('deposited_at', { ascending: true })
    .limit(50)
  return data ?? []
})

type Row = NonNullable<typeof rows.value>[number]

// ponytail: filter locally like payouts — a RW-bound petugas only validates own-RW requests
const visible = computed(() => (rows.value ?? []).filter(r => !scopeRw.value || residentRw(r.resident) === scopeRw.value))

const { search, page, pageSize, paged, total } = useTablePage(
  visible,
  (r, q) => residentLabel(r.resident).toLowerCase().includes(q),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'resident', header: () => t('verify.colResident') },
  { accessorKey: 'estimated_weight', header: () => t('verify.colDeclared') },
  { accessorKey: 'deposited_at', header: () => t('verify.colTime') },
  { id: 'actions' },
]

const acting = ref<string | null>(null)
const open = ref(false)
const editing = ref<Row | null>(null)
// lines hold the typed text, not a number: the petugas corrects what the keyboard gave
const lines = ref<{ id: string, name: string, price: number, weightText: string }[]>([])

function openVerify(row: Row) {
  editing.value = row
  lines.value = (row.items ?? []).map(i => ({
    id: i.id,
    name: i.category_name,
    price: Number(i.price_per_kg),
    weightText: String(Number(i.weight_kg)),
  }))
  open.value = true
}

const lineValue = (l: { price: number, weightText: string }) => Math.round(parseWeightKg(l.weightText) * l.price)
const finalKg = computed(() => lines.value.reduce((s, l) => s + parseWeightKg(l.weightText), 0))
const finalValue = computed(() => lines.value.reduce((s, l) => s + lineValue(l), 0))

async function verify() {
  const dep = editing.value
  if (!dep) return
  const weighed = lines.value.map(l => ({ ...l, kg: parseWeightKg(l.weightText) }))
  if (!weighed.length || weighed.some(l => !l.kg)) {
    toast.add({ title: t('verify.needWeight'), color: 'warning' })
    return
  }
  acting.value = dep.id
  // berat sesudah: the re-weighed lines replace the declared ones
  for (const l of weighed) {
    const { error } = await client.from('deposit_items')
      .update({ weight_kg: l.kg, value: Math.round(l.kg * l.price) })
      .eq('id', l.id)
    if (error) {
      acting.value = null
      toast.add({ title: error.message, color: 'error' })
      return
    }
  }
  const { error: depErr } = await client.from('deposits').update({
    total_weight: finalKg.value,
    total_value: finalValue.value,
    status: 'tercatat',
    verified_by: myId,
    verified_at: new Date().toISOString(),
  }).eq('id', dep.id)
  if (depErr) {
    acting.value = null
    toast.add({ title: depErr.message, color: 'error' })
    return
  }
  const { error: ledgerErr } = await client.from('savings_ledger').insert({
    resident_id: dep.resident_id,
    type: 'kredit',
    amount: finalValue.value,
    reference: `deposit:${dep.id}`,
  })
  acting.value = null
  open.value = false
  if (ledgerErr) {
    toast.add({ title: ledgerErr.message, color: 'error' })
    return
  }
  toast.add({ title: t('verify.validated'), color: 'success' })
  await refresh()
}

async function reject(row: Row) {
  acting.value = row.id
  const { error } = await client.from('deposits').update({
    status: 'ditolak',
    verified_by: myId,
    verified_at: new Date().toISOString(),
  }).eq('id', row.id)
  acting.value = null
  if (error) {
    toast.add({ title: error.message, color: 'error' })
    return
  }
  toast.add({ title: t('verify.rejected'), color: 'success' })
  await refresh()
}

function residentLabel(resident: unknown) {
  const r = resident as { full_name: string, area: { rw: string, rt: string } | null } | null
  if (!r) return '-'
  const area = r.area ? ` · ${r.area.rw} · ${r.area.rt}` : ''
  return `${r.full_name}${area}`
}

const residentRw = (resident: unknown) => (resident as { area: { rw: string } | null } | null)?.area?.rw ?? null
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('verify.title')" />
    </template>

    <template #body>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p class="text-sm text-muted">{{ $t('verify.subtitle') }}</p>
        <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('common.search')" class="w-full sm:w-56" />
      </div>

      <UTable :data="paged" :columns="columns" :loading="status === 'pending'">
        <template #resident-cell="{ row }">
          {{ residentLabel(row.original.resident) }}
        </template>
        <template #estimated_weight-cell="{ row }">
          <span class="tabular-nums">{{ fmtKg(Number(row.original.estimated_weight ?? 0)) }}</span>
        </template>
        <template #deposited_at-cell="{ row }">
          {{ fmtDate.format(new Date(row.original.deposited_at)) }}
        </template>
        <template #actions-cell="{ row }">
          <div class="flex gap-1">
            <UButton size="xs" :label="$t('verify.validate')" @click="openVerify(row.original)" />
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              :label="$t('verify.reject')"
              :loading="acting === row.original.id"
              @click="reject(row.original)"
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

      <UModal v-model:open="open" :title="$t('verify.modalTitle')" :description="editing ? residentLabel(editing.resident) : ''">
        <template #body>
          <div class="grid gap-3">
            <p class="text-sm text-muted">
              {{ $t('verify.declaredHint', { weight: fmtKg(Number(editing?.estimated_weight ?? 0)) }) }}
            </p>
            <div v-for="(l, idx) in lines" :key="l.id" class="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-2 sm:items-end">
              <UFormField :name="`weight-${idx}`" :label="l.name">
                <UInput v-model="l.weightText" inputmode="decimal" class="w-full" />
              </UFormField>
              <span class="text-sm tabular-nums sm:pb-2.5">{{ fmtRp.format(lineValue(l)) }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 border-t border-muted pt-3">
              <span class="text-sm text-muted">{{ $t('verify.finalWeight') }} · <span class="tabular-nums">{{ fmtKg(finalKg) }}</span></span>
              <span class="font-bold tabular-nums">{{ fmtRp.format(finalValue) }}</span>
            </div>
            <div class="flex justify-end gap-2">
              <UButton :label="$t('common.cancel')" color="neutral" variant="outline" @click="open = false" />
              <UButton :label="$t('verify.save')" :loading="acting === editing?.id" @click="verify" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
