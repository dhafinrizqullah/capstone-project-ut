<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['pengepul'] })

const { locale, t } = useI18n()
const myId = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }).format(v)} kg`
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))

const { data: ships, status, refresh } = await useAsyncData('handover', async () => {
  // ponytail: superadmin sees every shipment (global scope); collectors see only their own
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

async function toggle(id: number) {
  expanded.value = expanded.value === id ? null : id
  if (expanded.value === id && !itemsCache.value[id]) {
    const { data } = await client
      .from('shipment_items')
      .select('weight_kg,value,category:waste_categories!shipment_items_category_id_fkey(name)')
      .eq('shipment_id', id)
    itemsCache.value[id] = (data ?? []).map(i => ({
      name: (i.category as unknown as { name: string } | null)?.name ?? '-',
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
      <p class="text-sm text-muted mb-4">{{ $t('handover.subtitle') }}</p>
      <p v-if="status === 'pending'" class="text-sm text-muted">{{ $t('common.loading') }}</p>
      <p v-else-if="!ships?.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
      <div v-else class="grid gap-3">
        <UCard v-for="s in ships" :key="s.id">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <button class="text-left" @click="toggle(s.id)">
              <span class="font-extrabold">{{ $t('handover.note') }} {{ s.note_number }}</span>
              <span class="block text-sm text-muted tabular-nums">{{ fmtDate.format(new Date(s.shipped_at)) }}</span>
            </button>
            <UBadge :color="s.status === 'diterima' ? 'success' : 'warning'" variant="subtle">
              {{ s.status === 'diterima' ? $t('handover.received') : $t('handover.sent') }}
            </UBadge>
          </div>
          <div class="mt-2 flex flex-wrap gap-4 text-sm">
            <span>{{ $t('handover.weight') }}: <strong class="tabular-nums">{{ fmtKg(Number(s.total_weight)) }}</strong></span>
            <span>{{ $t('handover.value') }}: <strong class="tabular-nums">{{ fmtRp.format(Number(s.total_value)) }}</strong></span>
          </div>
          <div v-if="expanded === s.id" class="mt-3 border-t border-muted pt-3">
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
    </template>
  </UDashboardPanel>
</template>
