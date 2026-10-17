<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'ship.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas'] })

const { locale, t } = useI18n()
const myId = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))

const { data: refs, refresh: refreshRefs } = await useAsyncData('ship-refs', async () => {
  const [collectors, cats, recent] = await Promise.all([
    client.from('profiles').select('id,full_name').eq('role', 'pengepul').order('full_name'),
    client.from('waste_categories').select('id,name,price_per_kg').eq('active', true).order('name'),
    client.from('shipments').select('id,note_number,total_weight,total_value,status,shipped_at').order('shipped_at', { ascending: false }).limit(10),
  ])
  return { collectors: collectors.data ?? [], cats: cats.data ?? [], recent: recent.data ?? [] }
})

const collectorId = ref<string>()
const categoryId = ref<number>()
const weightKg = ref<number>()
const items = ref<{ categoryId: number, name: string, weightKg: number, price: number, value: number }[]>([])
const saving = ref(false)

const collectorItems = computed(() => (refs.value?.collectors ?? []).map(c => ({ label: c.full_name, value: c.id })))
const categoryItems = computed(() => (refs.value?.cats ?? []).map(c => ({ label: `${c.name} · ${fmtRp.value.format(Number(c.price_per_kg))}/kg`, value: c.id })))
const total = computed(() => items.value.reduce((s, i) => s + i.value, 0))
const totalKg = computed(() => items.value.reduce((s, i) => s + i.weightKg, 0))

function addItem() {
  const cat = (refs.value?.cats ?? []).find(c => c.id === categoryId.value)
  if (!cat || !weightKg.value || weightKg.value <= 0) return
  const price = Number(cat.price_per_kg)
  items.value.push({ categoryId: cat.id, name: cat.name, weightKg: weightKg.value, price, value: Math.round(weightKg.value * price) })
  categoryId.value = undefined
  weightKg.value = undefined
}

async function submit() {
  if (!collectorId.value) {
    toast.add({ title: t('ship.needCollector'), color: 'warning' })
    return
  }
  if (!items.value.length) {
    toast.add({ title: t('ship.needItem'), color: 'warning' })
    return
  }
  saving.value = true
  const { data: ship, error: shipErr } = await client.from('shipments').insert({
    collector_id: collectorId.value,
    operator_id: myId,
    total_weight: totalKg.value,
    total_value: total.value,
  }).select('id,note_number').single()
  if (shipErr || !ship) {
    saving.value = false
    toast.add({ title: shipErr?.message ?? 'Error', color: 'error' })
    return
  }
  const { error: itemsErr } = await client.from('shipment_items').insert(
    items.value.map(i => ({ shipment_id: ship.id, category_id: i.categoryId, category_name: i.name, weight_kg: i.weightKg, price_per_kg: i.price, value: i.value })),
  )
  saving.value = false
  if (itemsErr) {
    toast.add({ title: itemsErr.message, color: 'error' })
    return
  }
  items.value = []
  collectorId.value = undefined
  toast.add({ title: t('ship.issued', { note: ship.note_number }), color: 'success' })
  await refreshRefs()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('ship.title')" />
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('ship.subtitle') }}</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <UCard>
          <div class="grid gap-4">
            <UFormField name="collector" :label="$t('ship.collector')" required>
              <USelectMenu
                v-model="collectorId"
                value-key="value"
                :items="collectorItems"
                :placeholder="$t('ship.pickCollector')"
                searchable
                class="w-full"
              />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-[1fr_130px_auto] gap-2 sm:items-end">
              <UFormField name="category" :label="$t('ship.category')">
                <USelectMenu
                  v-model="categoryId"
                  value-key="value"
                  :items="categoryItems"
                  :placeholder="$t('ship.category')"
                  searchable
                  class="w-full"
                />
              </UFormField>
              <UFormField name="weight" :label="$t('ship.weightKg')">
                <UInputNumber v-model="weightKg" :min="0.1" :step="0.5" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-plus" :label="$t('ship.addItem')" @click="addItem" />
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-bold">{{ $t('ship.total') }}</h2>
              <span class="text-xl font-extrabold tabular-nums">{{ fmtRp.format(total) }}</span>
            </div>
          </template>
          <p v-if="!items.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
          <ul v-else class="grid gap-2 mb-4">
            <li v-for="(it, idx) in items" :key="idx" class="flex items-center justify-between gap-2 text-sm">
              <span>{{ it.name }} · <span class="tabular-nums">{{ it.weightKg }} kg</span></span>
              <span class="flex items-center gap-2">
                <span class="font-bold tabular-nums">{{ fmtRp.format(it.value) }}</span>
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="it.name" @click="items.splice(idx, 1)" />
              </span>
            </li>
          </ul>
          <UButton :label="$t('ship.submit')" :loading="saving" :disabled="!items.length" block size="lg" @click="submit" />
        </UCard>
      </div>

      <UCard>
        <template #header>
          <h2 class="font-bold">{{ $t('ship.history') }}</h2>
        </template>
        <p v-if="!refs?.recent.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
        <ul v-else class="grid gap-2">
          <li v-for="s in refs.recent" :key="s.id" class="flex items-center justify-between gap-2 text-sm">
            <span class="font-bold">{{ s.note_number }}</span>
            <span class="tabular-nums">{{ fmtDate.format(new Date(s.shipped_at)) }}</span>
            <UBadge :color="s.status === 'diterima' ? 'success' : 'warning'" variant="subtle">{{ s.status }}</UBadge>
          </li>
        </ul>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
