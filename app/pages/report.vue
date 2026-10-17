<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['pengurus_rw'] })

const { locale, t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtInt = computed(() => new Intl.NumberFormat(tag.value, { maximumFractionDigits: 0 }))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))

const exporting = ref(false)

// RW-bound staff only report on their own RW
const { scopeRw } = await useMyScope()

async function buildRows() {
  const [depRes, itemsRes, catsRes, rtRes, ledgerRes] = await Promise.all([
    client.from('deposits').select('id,total_weight,total_value,deposited_at,resident_id').eq('status', 'tercatat'),
    client.from('deposit_items').select('deposit_id,category_id,weight_kg'),
    client.from('waste_categories').select('id,name'),
    client.from('profiles').select('id,area:areas!profiles_area_id_fkey(rw,rt)').eq('role', 'warga'),
    client.from('savings_ledger').select('resident_id,type,amount'),
  ])
  const catNames = new Map((catsRes.data ?? []).map(c => [c.id, c.name]))
  const rtOf = new Map((rtRes.data ?? []).map((p) => {
    const area = p.area as unknown as { rw: string, rt: string } | null
    return [p.id, { rw: area?.rw ?? '?', rt: area?.rt ?? '?' }] as const
  }))
  const inScopeResident = (id: string) => !scopeRw.value || rtOf.get(id)?.rw === scopeRw.value

  const deps = (depRes.data ?? []).filter(d => inScopeResident(d.resident_id))
  const depIds = new Set(deps.map(d => d.id))
  const items = (itemsRes.data ?? []).filter(i => depIds.has(i.deposit_id))
  const ledger = (ledgerRes.data ?? []).filter(l => inScopeResident(l.resident_id))

  const totalKg = deps.reduce((s, d) => s + Number(d.total_weight), 0)
  const totalRp = deps.reduce((s, d) => s + Number(d.total_value), 0)
  const balance = ledger.reduce((s, l) => s + (l.type === 'kredit' ? Number(l.amount) : -Number(l.amount)), 0)

  const byCat = new Map<string, number>()
  for (const it of items) {
    const n = catNames.get(it.category_id) ?? '?'
    byCat.set(n, (byCat.get(n) ?? 0) + Number(it.weight_kg))
  }
  const byRt = new Map<string, number>()
  for (const d of deps) {
    const s = rtOf.get(d.resident_id) ?? { rw: '?', rt: '?' }
    const key = `${s.rw} · ${s.rt}`
    byRt.set(key, (byRt.get(key) ?? 0) + Number(d.total_weight))
  }
  return {
    kpi: [
      [t('dash.kpiWaste'), `${fmtInt.value.format(Math.round(totalKg))} kg`],
      [t('dash.kpiBalance'), fmtRp.value.format(balance)],
      [t('dash.kpiCount'), fmtInt.value.format(deps.length)],
      [t('resident.balance') + ' / ' + t('dash.kpiWaste'), fmtRp.value.format(totalRp)],
    ],
    cats: [...byCat.entries()].map(([name, kg]) => [name, fmtInt.value.format(Math.round(kg))]),
    rt: [...byRt.entries()].map(([rt, kg]) => [rt, fmtInt.value.format(Math.round(kg))]),
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    // xlsx ships an ESM build with no default export: take the namespace itself
    const XLSX = await import('xlsx')
    const rows = await buildRows()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[t('report.title')], ...rows.kpi]), 'Ringkasan')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Kategori', 'kg'], ...rows.cats]), 'Kategori')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['RT', 'kg'], ...rows.rt]), 'Per RT')
    XLSX.writeFile(wb, `laporan-rw-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  catch (e) {
    toast.add({ title: (e as Error).message, color: 'error' })
  }
  exporting.value = false
}

function printPdf() {
  window.print()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('report.title')" />
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('report.subtitle') }}</p>
      <div class="flex flex-wrap gap-3 mb-4 print:hidden">
        <UButton icon="i-lucide-file-spreadsheet" :label="$t('report.exportExcel')" :loading="exporting" @click="exportExcel" />
        <UButton icon="i-lucide-printer" color="neutral" variant="outline" :label="$t('report.printPdf')" @click="printPdf" />
      </div>
      <UAlert color="info" variant="soft" :title="$t('report.hint')" />
    </template>
  </UDashboardPanel>
</template>
