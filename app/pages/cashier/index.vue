<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'cashier.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['petugas'] })

const { locale, t } = useI18n()
const myId = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()
const { scopeRw } = await useMyScope()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))

const { data } = await useAsyncData('cashier-refs', async () => {
  const [residents, cats] = await Promise.all([
    client.from('profiles').select('id,full_name,area:areas!profiles_area_id_fkey(rw,rt)').eq('role', 'warga').order('full_name'),
    client.from('waste_categories').select('id,name,price_per_kg').eq('active', true).order('name'),
  ])
  return {
    // a RW-bound operator only serves their own RW
    residents: (residents.data ?? [])
      .map(r => ({
        id: r.id,
        full_name: r.full_name,
        area: r.area as unknown as { rw: string, rt: string } | null,
      }))
      .filter(r => !scopeRw.value || r.area?.rw === scopeRw.value),
    cats: cats.data ?? [],
  }
})

const residentId = ref<string>()
const categoryId = ref<number>()
const weightKg = ref<number>()
const items = ref<{ categoryId: number, name: string, weightKg: number, price: number, value: number }[]>([])
const saving = ref(false)

const residentItems = computed(() => (data.value?.residents ?? []).map(r => ({
  label: `${r.full_name} · ${r.area?.rw ?? '-'} · ${r.area?.rt ?? '-'}`,
  value: r.id,
})))
const categoryItems = computed(() => (data.value?.cats ?? []).map(c => ({ label: `${c.name} · ${fmtRp.value.format(Number(c.price_per_kg))}/kg`, value: c.id })))
const total = computed(() => items.value.reduce((s, i) => s + i.value, 0))
const totalKg = computed(() => items.value.reduce((s, i) => s + i.weightKg, 0))

function addItem() {
  const cat = (data.value?.cats ?? []).find(c => c.id === categoryId.value)
  if (!cat || !weightKg.value || weightKg.value <= 0) return
  const price = Number(cat.price_per_kg)
  items.value.push({ categoryId: cat.id, name: cat.name, weightKg: weightKg.value, price, value: Math.round(weightKg.value * price) })
  categoryId.value = undefined
  weightKg.value = undefined
}

function removeItem(idx: number) {
  items.value.splice(idx, 1)
}

async function submit() {
  if (!residentId.value) {
    toast.add({ title: t('cashier.needResident'), color: 'warning' })
    return
  }
  if (!items.value.length) {
    toast.add({ title: t('cashier.needItem'), color: 'warning' })
    return
  }
  saving.value = true
  // Header first; if items fail, the header is voided (simple compensation)
  const { data: dep, error: depErr } = await client.from('deposits').insert({
    resident_id: residentId.value,
    operator_id: myId,
    total_weight: totalKg.value,
    total_value: total.value,
  }).select('id').single()
  if (depErr || !dep) {
    saving.value = false
    toast.add({ title: depErr?.message ?? 'Error', color: 'error' })
    return
  }
  const { error: itemsErr } = await client.from('deposit_items').insert(
    items.value.map(i => ({ deposit_id: dep.id, category_id: i.categoryId, category_name: i.name, weight_kg: i.weightKg, price_per_kg: i.price, value: i.value })),
  )
  if (itemsErr) {
    await client.from('deposits').update({ status: 'dibatalkan' }).eq('id', dep.id)
    saving.value = false
    toast.add({ title: itemsErr.message, color: 'error' })
    return
  }
  const { error: ledgerErr } = await client.from('savings_ledger').insert({
    resident_id: residentId.value,
    type: 'kredit',
    amount: total.value,
    reference: `deposit:${dep.id}`,
  })
  saving.value = false
  if (ledgerErr) {
    toast.add({ title: ledgerErr.message, color: 'error' })
    return
  }
  items.value = []
  residentId.value = undefined
  toast.add({ title: t('cashier.saved'), color: 'success' })
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('cashier.title')" />
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('cashier.subtitle') }}</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UCard>
          <div class="grid gap-4">
            <UFormField name="resident" :label="$t('cashier.resident')" required>
              <USelectMenu
                v-model="residentId"
                value-key="value"
                :items="residentItems"
                :placeholder="$t('cashier.pickResident')"
                searchable
                class="w-full"
              />
            </UFormField>

            <div class="grid grid-cols-1 sm:grid-cols-[1fr_130px_auto] gap-2 sm:items-end">
              <UFormField name="category" :label="$t('cashier.category')">
                <USelectMenu
                  v-model="categoryId"
                  value-key="value"
                  :items="categoryItems"
                  :placeholder="$t('cashier.pickCategory')"
                  searchable
                  class="w-full"
                />
              </UFormField>
              <UFormField name="weight" :label="$t('cashier.weightKg')">
                <UInputNumber v-model="weightKg" :min="0.1" :step="0.5" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-plus" :label="$t('cashier.addItem')" @click="addItem" />
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-bold">{{ $t('cashier.total') }}</h2>
              <span class="text-xl font-extrabold tabular-nums">{{ fmtRp.format(total) }}</span>
            </div>
          </template>
          <p v-if="!items.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
          <ul v-else class="grid gap-2 mb-4">
            <li v-for="(it, idx) in items" :key="idx" class="flex items-center justify-between gap-2 text-sm">
              <span>{{ it.name }} · <span class="tabular-nums">{{ it.weightKg }} kg</span></span>
              <span class="flex items-center gap-2">
                <span class="font-bold tabular-nums">{{ fmtRp.format(it.value) }}</span>
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="it.name" @click="removeItem(idx)" />
              </span>
            </li>
          </ul>
          <UButton :label="$t('cashier.submit')" :loading="saving" :disabled="!items.length" block size="lg" @click="submit" />
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
