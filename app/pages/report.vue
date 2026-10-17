<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'report.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['pengurus_rw'] })

const { locale, t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtInt = computed(() => new Intl.NumberFormat(tag.value, { maximumFractionDigits: 0 }))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtDay = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }))
const fmtStamp = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' }))

// RW-bound staff only report on their own RW
const { scopeRw } = await useMyScope()

const exporting = ref(false)

async function buildReport() {
  const [depRes, itemsRes, profRes, ledgerRes] = await Promise.all([
    client.from('deposits').select('id,total_weight,total_value,deposited_at,resident_id').eq('status', 'tercatat'),
    client.from('deposit_items').select('deposit_id,category_name,weight_kg,price_per_kg,value'),
    client.from('profiles').select('id,full_name,area:areas!profiles_area_id_fkey(rw,rt)').eq('role', 'warga'),
    client.from('savings_ledger').select('resident_id,type,amount'),
  ])
  const personOf = new Map((profRes.data ?? []).map((p) => {
    const area = p.area as unknown as { rw: string, rt: string } | null
    return [p.id, { name: p.full_name, rw: area?.rw ?? '?', rt: area?.rt ?? '?' }] as const
  }))
  const inScope = (id: string) => !scopeRw.value || personOf.get(id)?.rw === scopeRw.value

  const deps = (depRes.data ?? []).filter(d => inScope(d.resident_id))
  const depIds = new Set(deps.map(d => d.id))
  const items = (itemsRes.data ?? []).filter(i => depIds.has(i.deposit_id))
  const ledger = (ledgerRes.data ?? []).filter(l => inScope(l.resident_id))

  const totalKg = deps.reduce((s, d) => s + Number(d.total_weight), 0)
  const totalRp = deps.reduce((s, d) => s + Number(d.total_value), 0)
  const balance = ledger.reduce((s, l) => s + (l.type === 'kredit' ? Number(l.amount) : -Number(l.amount)), 0)

  // snapshot names: a renamed master never rewrites a past report
  const byCat = new Map<string, number>()
  for (const it of items) {
    byCat.set(it.category_name, (byCat.get(it.category_name) ?? 0) + Number(it.weight_kg))
  }
  const byRt = new Map<string, number>()
  for (const d of deps) {
    const s = personOf.get(d.resident_id) ?? { rw: '?', rt: '?' }
    const key = `${s.rw} · ${s.rt}`
    byRt.set(key, (byRt.get(key) ?? 0) + Number(d.total_weight))
  }

  // per-row detail for the sheet that carries the raw lines
  const depOf = new Map(deps.map(d => [d.id, d]))
  const byDay = (a: { deposited_at: string }, b: { deposited_at: string }) => +new Date(a.deposited_at) - +new Date(b.deposited_at)
  const who = (id: string) => personOf.get(id) ?? { name: '?', rw: '?', rt: '?' }
  const weighings = [...deps].sort(byDay).map((d) => {
    const p = who(d.resident_id)
    return [fmtDay.value.format(new Date(d.deposited_at)), p.name, p.rw, p.rt, Number(d.total_weight), Number(d.total_value)]
  })
  const lines = [...items].sort((a, b) => byDay(depOf.get(a.deposit_id)!, depOf.get(b.deposit_id)!)).map((it) => {
    const dep = depOf.get(it.deposit_id)!
    const p = who(dep.resident_id)
    return [fmtDay.value.format(new Date(dep.deposited_at)), p.name, p.rw, p.rt, it.category_name, Number(it.weight_kg), Number(it.price_per_kg), Number(it.value)]
  })

  return {
    generated: fmtStamp.value.format(new Date()),
    units: scopeRw.value ?? t('common.all'),
    kpi: [
      [t('dash.kpiWaste'), `${fmtInt.value.format(Math.round(totalKg))} kg`],
      [t('dash.kpiBalance'), fmtRp.value.format(balance)],
      [t('dash.kpiCount'), fmtInt.value.format(deps.length)],
      [t('report.totalValue'), fmtRp.value.format(totalRp)],
    ],
    cats: [...byCat.entries()].map(([name, kg]) => [name, fmtInt.value.format(Math.round(kg))]),
    rt: [...byRt.entries()].map(([rt, kg]) => [rt, fmtInt.value.format(Math.round(kg))]),
    weighings,
    lines,
  }
}

const { data: report } = await useAsyncData('report', buildReport)

async function exportExcel() {
  exporting.value = true
  try {
    // xlsx ships an ESM build with no default export: take the namespace itself
    const XLSX = await import('xlsx')
    const r = report.value ?? await buildReport()
    const wb = XLSX.utils.book_new()
    const add = (name: string, head: string[], rows: (string | number)[][]) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows]), name)

    add(t('report.summary'), [t('report.title'), `${t('report.generated')}: ${r.generated}`], r.kpi)
    add(t('report.byCategory'), [t('prices.colName'), t('resident.colWeight')], r.cats)
    add(t('report.byRt'), [`${t('users.colRw')} · ${t('users.colRt')}`, t('resident.colWeight')], r.rt)
    // one line per weighing and per item line, so the sheet can be filtered
    add(t('report.weighings'), [t('resident.colDate'), t('payouts.colResident'), t('users.colRw'), t('users.colRt'), t('resident.colWeight'), t('resident.colValue')], r.weighings)
    add(t('report.items'), [t('resident.colDate'), t('payouts.colResident'), t('users.colRw'), t('users.colRt'), t('prices.colName'), t('resident.colWeight'), t('prices.colPrice'), t('resident.colValue')], r.lines)

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
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <p class="text-sm text-muted">{{ $t('report.subtitle') }}</p>
        <div class="flex flex-wrap gap-3">
          <UButton icon="i-lucide-file-spreadsheet" :label="$t('report.exportExcel')" :loading="exporting" @click="exportExcel" />
          <UButton icon="i-lucide-printer" color="neutral" variant="outline" :label="$t('report.printPdf')" @click="printPdf" />
        </div>
      </div>

      <!-- the recap itself: what the browser prints, and what the screen shows -->
      <div class="grid gap-4">
        <div>
          <h2 class="text-lg font-extrabold text-highlighted">{{ $t('report.title') }}</h2>
          <p class="text-sm text-muted">
            {{ $t('report.generated') }}: {{ report?.generated ?? '…' }}
            · {{ $t('report.ward') }}: {{ report?.units ?? '…' }}
          </p>
        </div>

        <section class="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <article v-for="[label, value] in report?.kpi ?? []" :key="label" class="bg-default border border-default rounded-2xl p-4">
            <div class="text-sm font-semibold text-muted">{{ label }}</div>
            <div class="text-2xl font-extrabold tabular-nums mt-1">{{ value }}</div>
          </article>
        </section>

        <div class="grid gap-4 lg:grid-cols-2">
          <section class="bg-default border border-default rounded-2xl p-5">
            <h3 class="font-bold mb-3 text-highlighted">{{ $t('report.byCategory') }}</h3>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs uppercase tracking-wide text-muted">
                  <th class="py-2 text-left">{{ $t('prices.colName') }}</th>
                  <th class="py-2 text-right">{{ $t('resident.colWeight') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="[name, kg] in report?.cats ?? []" :key="name" class="border-t border-muted">
                  <td class="py-2">{{ name }}</td>
                  <td class="py-2 text-right tabular-nums">{{ kg }} kg</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="bg-default border border-default rounded-2xl p-5">
            <h3 class="font-bold mb-3 text-highlighted">{{ $t('report.byRt') }}</h3>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs uppercase tracking-wide text-muted">
                  <th class="py-2 text-left">{{ $t('users.colRw') }} · {{ $t('users.colRt') }}</th>
                  <th class="py-2 text-right">{{ $t('resident.colWeight') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="[rt, kg] in report?.rt ?? []" :key="rt" class="border-t border-muted">
                  <td class="py-2">{{ rt }}</td>
                  <td class="py-2 text-right tabular-nums">{{ kg }} kg</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <UAlert color="info" variant="soft" :title="$t('report.hint')" class="print:hidden" />
      </div>
    </template>
  </UDashboardPanel>
</template>
