<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()

// ponytail: mockup statis — angka & tanggal diformat via Intl, sumber data Supabase menyusul
const fmtDecimal = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
const fmtRp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtRpCompact = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 })
const fmtDateTime = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtKg = (v: number) => `${fmtDecimal.format(v)} kg`
const fmtActivityTime = (iso: string) => fmtDateTime.format(new Date(iso))

const menu = ['Dasbor Analitik', 'Transaksi Penimbangan', 'Master Harga Sampah', 'Tabungan Warga', 'Nota Pengepul', 'Laporan RW', 'Pengaturan']

const kpis = [
  { label: 'Total Sampah Terkumpul', value: `${fmtDecimal.format(12.4)} ton`, delta: '+8,2% vs bulan lalu' },
  { label: 'Warga Aktif', value: fmtDecimal.format(326), delta: '+14 warga baru' },
  { label: 'Saldo Tabungan', value: fmtRpCompact.format(18_700_000), delta: `+${fmtRp.format(2_100_000)}` },
  { label: 'Kepatuhan Pilah', value: '94%', delta: 'Stabil di atas target' },
]

const activities = [
  { at: '2026-10-14T09:12:00+07:00', name: 'RT 01 - Budi S.', type: 'Plastik PET', weightKg: 4.2, valueRp: 18900, status: 'Tercatat' },
  { at: '2026-10-14T08:40:00+07:00', name: 'RT 03 - Siti A.', type: 'Organik', weightKg: 6.5, valueRp: 6500, status: 'Tercatat' },
  { at: '2026-10-13T16:10:00+07:00', name: 'RT 02 - Andi R.', type: 'Kertas', weightKg: 3.1, valueRp: 9300, status: 'Menunggu' },
  { at: '2026-10-13T10:05:00+07:00', name: 'RT 04 - Maya P.', type: 'Logam', weightKg: 1.8, valueRp: 10800, status: 'Tercatat' },
]

const trendCanvas = ref<HTMLCanvasElement | null>(null)
const categoryCanvas = ref<HTMLCanvasElement | null>(null)
const rtCanvas = ref<HTMLCanvasElement | null>(null)

onMounted(async () => {
  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)

  if (trendCanvas.value) {
    new Chart(trendCanvas.value, {
      type: 'line',
      data: {
        labels: ['Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt'],
        datasets: [{
          label: 'Total timbulan (kg)',
          data: [1820, 2100, 2440, 2380, 2690, 2910],
          borderColor: '#166534',
          backgroundColor: 'rgba(34,197,94,.16)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#22c55e',
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
    })
  }

  if (categoryCanvas.value) {
    new Chart(categoryCanvas.value, {
      type: 'doughnut',
      data: {
        labels: ['Plastik', 'Kertas', 'Organik', 'Logam', 'Kaca'],
        datasets: [{
          data: [38, 24, 21, 10, 7],
          backgroundColor: ['#166534', '#0f766e', '#15803d', '#22c55e', '#86efac'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
      },
    })
  }

  if (rtCanvas.value) {
    new Chart(rtCanvas.value, {
      type: 'bar',
      data: {
        labels: ['RT 01', 'RT 02', 'RT 03', 'RT 04', 'RT 05', 'RT 06'],
        datasets: [{
          label: 'Kg terkumpul',
          data: [820, 610, 740, 530, 460, 750],
          backgroundColor: '#22c55e',
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
    })
  }
})

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-emerald-50 lg:grid lg:grid-cols-[250px_1fr]">
    <aside class="bg-gradient-to-b from-emerald-950 to-emerald-700 text-emerald-50 p-6 flex flex-col gap-6">
      <div class="flex items-center gap-3 font-extrabold text-lg">
        <span class="w-9 h-9 rounded-xl bg-white/20 grid place-items-center">♻</span>
        <span>Bank Sampah</span>
      </div>

      <div>
        <p class="text-xs uppercase tracking-widest text-emerald-200 mb-2">Menu Utama</p>
        <nav>
          <ul class="grid gap-1">
            <li
              v-for="item in menu"
              :key="item"
              class="px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-100 hover:bg-white/10"
              :class="item === 'Dasbor Analitik' ? 'bg-white/20 text-white' : ''"
              :aria-current="item === 'Dasbor Analitik' ? 'page' : undefined"
            >
              {{ item }}
            </li>
          </ul>
        </nav>
      </div>

      <div class="mt-auto bg-white/10 rounded-2xl p-4 text-sm">
        <strong class="block mb-1">Pengurus RW 05</strong>
        <span class="text-emerald-200">Bandung, Jawa Barat</span>
        <button
          class="mt-4 w-full rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold py-2 transition"
          @click="logout"
        >
          Keluar
        </button>
      </div>
    </aside>

    <main class="p-6 lg:p-8 min-w-0">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight">Dasbor Analitik Timbulan Sampah</h1>
          <p class="text-slate-500 text-sm mt-1">Monitoring volume, partisipasi warga, dan tren bulanan tingkat komunitas RW.</p>
        </div>
        <span class="inline-flex items-center px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm w-fit">
          Periode: Oktober 2026
        </span>
      </div>

      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <article v-for="kpi in kpis" :key="kpi.label" class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
          <div class="text-sm font-semibold text-slate-500">{{ kpi.label }}</div>
          <div class="text-3xl font-extrabold tracking-tight mt-2 mb-1">{{ kpi.value }}</div>
          <div class="text-sm font-bold text-emerald-600">{{ kpi.delta }}</div>
        </article>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mb-5">
        <article class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
          <h2 class="font-bold mb-3">Tren Timbulan Sampah Bulanan (kg)</h2>
          <div class="h-72"><canvas ref="trendCanvas" /></div>
        </article>
        <article class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
          <h2 class="font-bold mb-3">Komposisi Kategori Sampah</h2>
          <div class="h-72"><canvas ref="categoryCanvas" /></div>
        </article>
      </section>

      <section class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm mb-5">
        <h2 class="font-bold mb-3">Keaktifan Partisipasi per RT (kg)</h2>
        <div class="h-64"><canvas ref="rtCanvas" /></div>
      </section>

      <section class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
        <h2 class="font-bold mb-3">Aktivitas Terbaru</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-slate-500 text-xs uppercase tracking-wide">
                <th class="py-2 px-2">Waktu</th>
                <th class="py-2 px-2">Warga / RT</th>
                <th class="py-2 px-2">Jenis Sampah</th>
                <th class="py-2 px-2">Berat</th>
                <th class="py-2 px-2">Nilai</th>
                <th class="py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in activities" :key="row.at + row.name" class="border-t border-emerald-50">
                <td class="py-2 px-2">{{ fmtActivityTime(row.at) }}</td>
                <td class="py-2 px-2">{{ row.name }}</td>
                <td class="py-2 px-2">{{ row.type }}</td>
                <td class="py-2 px-2">{{ fmtKg(row.weightKg) }}</td>
                <td class="py-2 px-2">{{ fmtRp.format(row.valueRp) }}</td>
                <td class="py-2 px-2">
                  <span
                    class="inline-block px-2.5 py-1 rounded-full text-xs font-bold"
                    :class="row.status === 'Tercatat' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
                  >
                    {{ row.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>
