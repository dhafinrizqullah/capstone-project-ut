<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'handover.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['pengepul'] })

const { locale, t } = useI18n()
const myId = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }).format(v)} kg`
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))

const { data: ships, status, refresh } = await useAsyncData('handover', async () => {  // ponytail: superadmin sees every shipment (global scope); collectors see only their own
  const { data: me } = await client.from('profiles').select('role').eq('id', myId).maybeSingle()
  let q = client
    .from('shipments')
    .select('id,note_number,total_weight,total_value,status,shipped_at')
    .order('shipped_at', { ascending: false })
    .limit(20)
  if (me?.role !== 'superadmin') q = q.eq('collector_id', myId)
  const { data } = await q
  return data ?? []
})

const expanded = ref<number | null>(null)
const itemsCache = ref<Record<number, { name: string, weightKg: number, value: number }[]>>({})
const confirming = ref<number | null>(null)

const { search, page, pageSize, paged, total } = useTablePage(ships, (s, q) => s.note_number.toLowerCase().includes(q))

async function toggle(id: number) {
  expanded.value = expanded.value === id ? null : id
  if (expanded.value === id && !itemsCache.value[id]) {
    const { data } = await client
      .from('shipment_items')
      .select('category_name,weight_kg,value')
      .eq('shipment_id', id)
    // the line carries its own name: renaming the master never rewrites a note
    itemsCache.value[id] = (data ?? []).map(i => ({
      name: i.category_name,
      weightKg: Number(i.weight_kg),
      value: Number(i.value),
    }))
  }
}

async function confirm(id: number) {
  confirming.value = id
  const { error } = await client.from('shipments').update({ status: 'diterima' }).eq('id', id)
  confirming.value = null
  if (error) {
    toast.add({ title: error.message, color: 'error' })
    return
  }
  toast.add({ title: t('handover.confirmed'), color: 'success' })
  await refresh()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('handover.title')" />
    </template>

    <template #body>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p class="text-sm text-muted">{{ $t('handover.subtitle') }}</p>
        <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('common.search')" class="w-full sm:w-56" />
      </div>
      <p v-if="status === 'pending'" class="text-sm text-muted">{{ $t('common.loading') }}</p>
      <p v-else-if="!paged.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
      <div v-else class="grid gap-3">
        <UCard v-for="s in paged" :key="s.id">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <!-- the note number is the control: chevron + link colour + a label, so the
                 row reads as clickable instead of looking like plain heading text -->
            <button
              type="button"
              class="group -m-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              :aria-expanded="expanded === s.id"
              :aria-controls="`note-items-${s.id}`"
              @click="toggle(s.id)"
            >
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 shrink-0 text-primary transition-transform duration-200 motion-reduce:transition-none"
                :class="expanded === s.id ? 'rotate-90' : ''"
              />
              <span class="min-w-0">
                <span class="font-extrabold text-primary underline decoration-dotted decoration-1 underline-offset-4">
                  {{ $t('handover.note') }} {{ s.note_number }}
                </span>
                <span class="block text-sm text-muted tabular-nums">{{ fmtDate.format(new Date(s.shipped_at)) }}</span>
              </span>
              <span class="ms-auto hidden shrink-0 text-xs font-semibold text-primary group-hover:underline sm:block">
                {{ expanded === s.id ? $t('handover.hideDetail') : $t('handover.showDetail') }}
              </span>
            </button>
            <UBadge :color="s.status === 'diterima' ? 'success' : 'warning'" variant="subtle">
              {{ s.status === 'diterima' ? $t('handover.received') : $t('handover.sent') }}
            </UBadge>
          </div>
          <div class="mt-2 flex flex-wrap gap-4 text-sm">
            <span>{{ $t('handover.weight') }}: <strong class="tabular-nums">{{ fmtKg(Number(s.total_weight)) }}</strong></span>
            <span>{{ $t('handover.value') }}: <strong class="tabular-nums">{{ fmtRp.format(Number(s.total_value)) }}</strong></span>
          </div>
          <div v-if="expanded === s.id" :id="`note-items-${s.id}`" class="mt-3 border-t border-muted pt-3">
            <p class="text-sm font-semibold mb-2">{{ $t('handover.items') }}</p>
            <ul class="grid gap-1 text-sm">
              <li v-for="(it, idx) in itemsCache[s.id] ?? []" :key="idx" class="flex justify-between gap-2">
                <span>{{ it.name }} · <span class="tabular-nums">{{ fmtKg(it.weightKg) }}</span></span>
                <span class="tabular-nums font-semibold">{{ fmtRp.format(it.value) }}</span>
              </li>
            </ul>
          </div>
          <div v-if="s.status !== 'diterima'" class="mt-3">
            <UButton :label="$t('handover.confirm')" :loading="confirming === s.id" @click="confirm(s.id)" />
          </div>
        </UCard>
      </div>
      <div v-if="total > pageSize" class="flex justify-end pt-4">
        <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" />
      </div>
    </template>
  </UDashboardPanel>
</template>
