<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { Chart as ChartJS } from 'chart.js'

definePageMeta({ titleKey: 'dash.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['pengurus_rw', 'superadmin'] })

const { locale, t } = useI18n()
const client = useSupabaseClient<Database>()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtInt = computed(() => new Intl.NumberFormat(tag.value, { maximumFractionDigits: 0 }))
const fmtTon = computed(() => new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }))
const fmtRpCompact = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${fmtInt.value.format(v)} kg`
const fmtMonth = computed(() => new Intl.DateTimeFormat(tag.value, { month: 'short' }))
const fmtTime = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))

const { preset, fromDate, toDate, from, to } = useDateRange()

const { data: dash, status } = await useAsyncData('dash', async () => {
  // the date window narrows the activity aggregates; the balance is a snapshot, not a period
  let depQ = client.from('deposits').select('id,resident_id,total_weight,total_value,deposited_at').eq('status', 'tercatat')
  let itemsQ = client
    .from('deposit_items')
    .select('deposit_id,category_name,weight_kg,deposits!inner(status,deposited_at)')
    .eq('deposits.status', 'tercatat')
  if (from.value) {
    depQ = depQ.gte('deposited_at', from.value)
    itemsQ = itemsQ.gte('deposits.deposited_at', from.value)
  }
  if (to.value) {
    depQ = depQ.lte('deposited_at', to.value)
    itemsQ = itemsQ.lte('deposits.deposited_at', to.value)
  }
  const [depRes, profRes, ledgerRes, itemsRes] = await Promise.all([
    depQ,
    client.from('profiles').select('id,full_name,area:areas!profiles_area_id_fkey(rw,rt)').eq('role', 'warga'),
    client.from('savings_ledger').select('resident_id,type,amount'),
    itemsQ,
  ])
  return {
    deposits: depRes.data ?? [],
    residents: new Map((profRes.data ?? []).map(p => [p.id, {
      full_name: p.full_name,
      rw: (p.area as unknown as { rw: string, rt: string } | null)?.rw ?? null,
      rt: (p.area as unknown as { rw: string, rt: string } | null)?.rt ?? null,
    }])),
    ledger: ledgerRes.data ?? [],
    items: itemsRes.data ?? [],
  }
}, { watch: [from, to] })

const loading = computed(() => status.value === 'pending' || status.value === 'idle')

// ponytail: superadmin sees everything with an RT filter; RW-bound staff (petugas,
// pengurus_rw) are pinned to their own RW, so their RT filter stays useful
const { role: myRole, scopeRw } = await useMyScope()
const rtFilter = ref('all')
const rwFilter = ref('all')
const rtOptions = computed(() => {
  const pool = [...(dash.value?.residents.values() ?? [])]
    .filter(p => rwFilter.value === 'all' || (p.rw ?? '?') === rwFilter.value)
    // RW-bound staff only ever see their own RW
    .filter(p => !scopeRw.value || (p.rw ?? '?') === scopeRw.value)
  const rts = [...new Set(pool.map(p => p.rt ?? '?'))].sort()
  return [{ label: t('common.all'), value: 'all' }, ...rts.map(rt => ({ label: rt, value: rt }))]
})
const rwOptions = computed(() => {
  const rws = [...new Set([...(dash.value?.residents.values() ?? [])].map(p => p.rw ?? '?'))].sort()
  return [{ label: t('common.all'), value: 'all' }, ...rws.map(rw => ({ label: rw, value: rw }))]
})
watch(rwFilter, () => { rtFilter.value = 'all' })
const scopeOf = (residentId: string) => {
  const p = dash.value?.residents.get(residentId)
  return { rw: p?.rw ?? '?', rt: p?.rt ?? '?' }
}
const inScope = (residentId: string) => {
  const s = scopeOf(residentId)
  // a RW-bound staff member never sees another RW, whatever the filters say
  if (scopeRw.value && s.rw !== scopeRw.value) return false
  return (rwFilter.value === 'all' || s.rw === rwFilter.value)
    && (rtFilter.value === 'all' || s.rt === rtFilter.value)
}
const fDeposits = computed(() => (dash.value?.deposits ?? []).filter(d => inScope(d.resident_id)))
const fDepositIds = computed(() => new Set(fDeposits.value.map(d => d.id)))
const fItems = computed(() => (dash.value?.items ?? []).filter(i => fDepositIds.value.has(i.deposit_id)))
const fLedger = computed(() => (dash.value?.ledger ?? []).filter(l => inScope(l.resident_id)))

const totalKg = computed(() => fDeposits.value.reduce((s, d) => s + Number(d.total_weight), 0))
const balance = computed(() => fLedger.value.reduce((s, l) => s + (l.type === 'kredit' ? Number(l.amount) : -Number(l.amount)), 0))

const fResidents = computed(() => [...(dash.value?.residents.entries() ?? [])].filter(([id]) => inScope(id)).map(([, p]) => p))

const kpis = computed(() => [
  { label: t('dash.kpiWaste'), value: `${fmtTon.value.format(totalKg.value / 1000)} ton` },
  { label: t('dash.kpiResidents'), value: fmtInt.value.format(fResidents.value.length) },
  { label: t('dash.kpiBalance'), value: fmtRpCompact.value.format(balance.value) },
  { label: t('dash.kpiCount'), value: fmtInt.value.format(fDeposits.value.length) },
])

// 6 bulan terakhir
const trend = computed(() => {
  const now = new Date()
  const buckets: { key: string, label: string, kg: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: fmtMonth.value.format(d), kg: 0 })
  }
  for (const dep of fDeposits.value) {
    const d = new Date(dep.deposited_at)
    const b = buckets.find(b => b.key === `${d.getFullYear()}-${d.getMonth()}`)
    if (b) b.kg += Number(dep.total_weight)
  }
  return buckets
})

const composition = computed(() => {
  const byCat = new Map<string, number>()
  for (const it of fItems.value) {
    // snapshot name: a renamed master does not rewrite past composition
    byCat.set(it.category_name, (byCat.get(it.category_name) ?? 0) + Number(it.weight_kg))
  }
  return [...byCat.entries()].map(([name, kg]) => ({ name, kg }))
})

const perRt = computed(() => {
  // ponytail: RT names repeat across RWs — qualify the label when viewing all RWs
  const byKey = new Map<string, number>()
  const allRws = rwFilter.value === 'all' && !scopeRw.value
  for (const dep of fDeposits.value) {
    const s = scopeOf(dep.resident_id)
    const key = allRws ? `${s.rw} · ${s.rt}` : s.rt
    byKey.set(key, (byKey.get(key) ?? 0) + Number(dep.total_weight))
  }
  return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([rt, kg]) => ({ rt, kg }))
})

const recent = computed(() => {
  const deps = [...fDeposits.value]
    .sort((a, b) => +new Date(b.deposited_at) - +new Date(a.deposited_at))
    .slice(0, 4)
  return deps.map((d) => {
    const prof = dash.value?.residents.get(d.resident_id)
    const first = fItems.value.find(i => i.deposit_id === d.id)
    // ponytail: person first, then area hierarchy — the RW only qualifies when the
    // viewer sees more than one (superadmin); RW-bound staff already know their RW
    const area = scopeRw.value ? (prof?.rt ?? '?') : `${prof?.rw ?? '?'} · ${prof?.rt ?? '?'}`
    return {
      id: d.id,
      time: fmtTime.value.format(new Date(d.deposited_at)),
      name: prof ? `${prof.full_name} · ${area}` : '?',
      type: first ? first.category_name : '-',
      weight: fmtKg(Number(d.total_weight)),
      value: fmtRp.value.format(Number(d.total_value)),
    }
  })
})

const trendCanvas = ref<HTMLCanvasElement | null>(null)
const categoryCanvas = ref<HTMLCanvasElement | null>(null)
const rtCanvas = ref<HTMLCanvasElement | null>(null)
let charts: ChartJS[] = []

// Chart.js paints on canvas: read the theme's own variables so the grid and
// labels stay readable in both modes (values resolve per mode, not per class).
function cssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function themeTokens() {
  return {
    grid: cssColor('--ui-border-muted', '#e8f0ea'),
    label: cssColor('--ui-text-muted', '#64748b'),
  }
}

async function drawCharts() {
  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)
  charts.forEach(c => c.destroy())
  charts = []
  const { grid, label } = themeTokens()
  if (trendCanvas.value) {
    charts.push(new Chart(trendCanvas.value, {
      type: 'line',
      data: {
        labels: trend.value.map(b => b.label),
        datasets: [{
          data: trend.value.map(b => Math.round(b.kg)),
          borderColor: '#059669',
          backgroundColor: 'rgba(16,185,129,.16)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: grid }, ticks: { color: label } },
          x: { grid: { display: false }, ticks: { color: label } },
        },
      },
    }))
  }
  if (categoryCanvas.value) {
    charts.push(new Chart(categoryCanvas.value, {
      type: 'doughnut',
      data: {
        labels: composition.value.map(c => c.name),
        datasets: [{
          data: composition.value.map(c => Math.round(c.kg)),
          backgroundColor: ['#065f46', '#0f766e', '#059669', '#10b981', '#6ee7b7', '#a7f3d0'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, color: label } } },
      },
    }))
  }
  if (rtCanvas.value) {
    charts.push(new Chart(rtCanvas.value, {
      type: 'bar',
      data: {
        labels: perRt.value.map(r => r.rt),
        datasets: [{
          data: perRt.value.map(r => Math.round(r.kg)),
          backgroundColor: '#10b981',
          borderRadius: 10,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: grid }, ticks: { color: label } },
          x: { grid: { display: false }, ticks: { color: label } },
        },
      },
    }))
  }
}

// ponytail: chart.js types every scale as a union; these two are all a mode
// flip needs to repaint
type ThemedAxis = { grid?: { color?: string }, ticks?: { color?: string } }

// A mode flip only changes the grid/label colours, so repaint the charts we
// already have. Rebuilding them cleared the canvas for a frame and replayed
// Chart.js' entry animation — that was the blink on this page.
function repaintCharts() {
  const { grid, label } = themeTokens()
  for (const chart of charts) {
    const scales = (chart.options.scales ?? {}) as Record<string, ThemedAxis | undefined>
    for (const id of ['x', 'y']) {
      const axis = scales[id]
      if (axis?.grid) axis.grid.color = grid
      if (axis?.ticks) axis.ticks.color = label
    }
    const legend = chart.options.plugins?.legend
    if (legend?.labels) legend.labels.color = label
    // 'none': swap the colours without animating the whole chart again
    chart.update('none')
  }
}

let themeObserver: MutationObserver | null = null
onMounted(() => {
  drawCharts()
  // the colour mode flips a class on <html>: repaint the canvases with the new vars
  themeObserver = new MutationObserver(repaintCharts)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
watch([trend, composition, perRt], drawCharts)
onUnmounted(() => {
  themeObserver?.disconnect()
  charts.forEach(c => c.destroy())
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('dash.title')" />
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p class="text-sm text-muted">{{ $t('dash.subtitle') }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <DateRangeFilter v-model:preset="preset" v-model:from="fromDate" v-model:to="toDate" />
          <template v-if="myRole === 'superadmin' || scopeRw">
            <USelect
              v-if="myRole === 'superadmin'"
              v-model="rwFilter"
              :items="rwOptions"
              value-key="value"
              :aria-label="$t('users.colRw')"
              class="w-36"
            />
            <USelect
              v-model="rtFilter"
              :items="rtOptions"
              value-key="value"
              :aria-label="$t('users.colRt')"
              class="w-36"
            />
          </template>
        </div>
      </div>

      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <USkeleton v-for="i in 4" :key="i" class="h-28 rounded-2xl" />
      </div>

      <template v-else>
        <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          <article v-for="kpi in kpis" :key="kpi.label" class="bg-default border border-default rounded-2xl p-5 shadow-sm">
            <div class="text-sm font-semibold text-muted">{{ kpi.label }}</div>
            <div class="text-3xl font-extrabold tracking-tight mt-2 mb-1 tabular-nums">{{ kpi.value }}</div>
          </article>
        </section>

        <!-- ponytail: min-w-0 — a canvas carries its last pixel width as intrinsic size, and a
             grid item's automatic min size would refuse to shrink back after the sidebar reopens -->
        <section class="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mb-5">
          <article class="min-w-0 bg-default border border-default rounded-2xl p-5 shadow-sm">
            <h2 class="font-bold mb-3">{{ $t('dash.trend') }}</h2>
            <div class="h-72"><canvas ref="trendCanvas" /></div>
          </article>
          <article class="min-w-0 bg-default border border-default rounded-2xl p-5 shadow-sm">
            <h2 class="font-bold mb-3">{{ $t('dash.composition') }}</h2>
            <div class="h-72"><canvas ref="categoryCanvas" /></div>
          </article>
        </section>

        <section class="bg-default border border-default rounded-2xl p-5 shadow-sm mb-5">
          <h2 class="font-bold mb-3">{{ $t('dash.perRt') }}</h2>
          <div class="h-64"><canvas ref="rtCanvas" /></div>
        </section>

        <section class="bg-default border border-default rounded-2xl p-5 shadow-sm">
          <h2 class="font-bold mb-3">{{ $t('dash.recent') }}</h2>
          <p v-if="!recent.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-muted text-xs uppercase tracking-wide">
                  <th class="py-2 px-2">{{ $t('dash.colTime') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colResident') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colType') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colWeight') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colValue') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colStatus') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in recent" :key="row.id" class="border-t border-muted">
                  <td class="py-2 px-2">{{ row.time }}</td>
                  <td class="py-2 px-2">{{ row.name }}</td>
                  <td class="py-2 px-2">{{ row.type }}</td>
                  <td class="py-2 px-2 tabular-nums">{{ row.weight }}</td>
                  <td class="py-2 px-2 tabular-nums">{{ row.value }}</td>
                  <td class="py-2 px-2">
                    <UBadge color="success" variant="subtle">{{ $t('dash.recorded') }}</UBadge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </UDashboardPanel>
</template>
