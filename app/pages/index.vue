<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['pengurus_rw'] })

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

const { data: dash, status } = await useAsyncData('dash', async () => {
  const [depRes, profRes, ledgerRes, itemsRes, catsRes] = await Promise.all([
    client.from('deposits').select('id,resident_id,total_weight,total_value,deposited_at').eq('status', 'tercatat'),
    client.from('profiles').select('id,full_name,rt').eq('role', 'warga'),
    client.from('savings_ledger').select('type,amount'),
    client.from('deposit_items').select('deposit_id,category_id,weight_kg'),
    client.from('waste_categories').select('id,name'),
  ])
  return {
    deposits: depRes.data ?? [],
    residents: new Map((profRes.data ?? []).map(p => [p.id, p])),
    ledger: ledgerRes.data ?? [],
    items: itemsRes.data ?? [],
    catNames: new Map((catsRes.data ?? []).map(c => [c.id, c.name])),
  }
})

const loading = computed(() => status.value === 'pending' || status.value === 'idle')

const totalKg = computed(() => (dash.value?.deposits ?? []).reduce((s, d) => s + Number(d.total_weight), 0))
const balance = computed(() => (dash.value?.ledger ?? []).reduce((s, l) => s + (l.type === 'kredit' ? Number(l.amount) : -Number(l.amount)), 0))

const kpis = computed(() => [
  { label: t('dash.kpiWaste'), value: `${fmtTon.value.format(totalKg.value / 1000)} ton` },
  { label: t('dash.kpiResidents'), value: fmtInt.value.format(dash.value?.residents.size ?? 0) },
  { label: t('dash.kpiBalance'), value: fmtRpCompact.value.format(balance.value) },
  { label: t('dash.kpiCount'), value: fmtInt.value.format(dash.value?.deposits.length ?? 0) },
])

// 6 bulan terakhir
const trend = computed(() => {
  const now = new Date()
  const buckets: { key: string, label: string, kg: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: fmtMonth.value.format(d), kg: 0 })
  }
  for (const dep of dash.value?.deposits ?? []) {
    const d = new Date(dep.deposited_at)
    const b = buckets.find(b => b.key === `${d.getFullYear()}-${d.getMonth()}`)
    if (b) b.kg += Number(dep.total_weight)
  }
  return buckets
})

const composition = computed(() => {
  const byCat = new Map<string, number>()
  for (const it of dash.value?.items ?? []) {
    const name = dash.value?.catNames.get(it.category_id) ?? '?'
    byCat.set(name, (byCat.get(name) ?? 0) + Number(it.weight_kg))
  }
  return [...byCat.entries()].map(([name, kg]) => ({ name, kg }))
})

const perRt = computed(() => {
  const byRt = new Map<string, number>()
  for (const dep of dash.value?.deposits ?? []) {
    const rt = dash.value?.residents.get(dep.resident_id)?.rt ?? '?'
    byRt.set(rt, (byRt.get(rt) ?? 0) + Number(dep.total_weight))
  }
  return [...byRt.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([rt, kg]) => ({ rt, kg }))
})

const recent = computed(() => {
  const deps = [...(dash.value?.deposits ?? [])]
    .sort((a, b) => +new Date(b.deposited_at) - +new Date(a.deposited_at))
    .slice(0, 4)
  return deps.map((d) => {
    const prof = dash.value?.residents.get(d.resident_id)
    const first = (dash.value?.items ?? []).find(i => i.deposit_id === d.id)
    return {
      id: d.id,
      time: fmtTime.value.format(new Date(d.deposited_at)),
      name: `${prof?.rt ?? '?'} - ${prof?.full_name ?? '?'}`,
      type: first ? (dash.value?.catNames.get(first.category_id) ?? '-') : '-',
      weight: fmtKg(Number(d.total_weight)),
      value: fmtRp.value.format(Number(d.total_value)),
    }
  })
})

const trendCanvas = ref<HTMLCanvasElement | null>(null)
const categoryCanvas = ref<HTMLCanvasElement | null>(null)
const rtCanvas = ref<HTMLCanvasElement | null>(null)
let charts: { destroy(): void }[] = []

async function drawCharts() {
  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)
  charts.forEach(c => c.destroy())
  charts = []
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
          y: { beginAtZero: true, grid: { color: '#e8f0ea' } },
          x: { grid: { display: false } },
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
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
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
          y: { beginAtZero: true, grid: { color: '#e8f0ea' } },
          x: { grid: { display: false } },
        },
      },
    }))
  }
}

onMounted(drawCharts)
watch([trend, composition, perRt], drawCharts)
onUnmounted(() => charts.forEach(c => c.destroy()))
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('dash.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('dash.subtitle') }}</p>

      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <USkeleton v-for="i in 4" :key="i" class="h-28 rounded-2xl" />
      </div>

      <template v-else>
        <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          <article v-for="kpi in kpis" :key="kpi.label" class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
            <div class="text-sm font-semibold text-slate-500">{{ kpi.label }}</div>
            <div class="text-3xl font-extrabold tracking-tight mt-2 mb-1 tabular-nums">{{ kpi.value }}</div>
          </article>
        </section>

        <section class="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mb-5">
          <article class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
            <h2 class="font-bold mb-3">{{ $t('dash.trend') }}</h2>
            <div class="h-72"><canvas ref="trendCanvas" /></div>
          </article>
          <article class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
            <h2 class="font-bold mb-3">{{ $t('dash.composition') }}</h2>
            <div class="h-72"><canvas ref="categoryCanvas" /></div>
          </article>
        </section>

        <section class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm mb-5">
          <h2 class="font-bold mb-3">{{ $t('dash.perRt') }}</h2>
          <div class="h-64"><canvas ref="rtCanvas" /></div>
        </section>

        <section class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
          <h2 class="font-bold mb-3">{{ $t('dash.recent') }}</h2>
          <p v-if="!recent.length" class="text-sm text-slate-500">{{ $t('common.empty') }}</p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-slate-500 text-xs uppercase tracking-wide">
                  <th class="py-2 px-2">{{ $t('dash.colTime') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colResident') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colType') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colWeight') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colValue') }}</th>
                  <th class="py-2 px-2">{{ $t('dash.colStatus') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in recent" :key="row.id" class="border-t border-emerald-50">
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
