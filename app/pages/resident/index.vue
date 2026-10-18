<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ titleKey: 'resident.title', layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['warga'] })

const { locale, t } = useI18n()
const uid = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }).format(v)} kg`

// histories live on their own pages (/resident/weighings, /resident/withdrawals)
const { data, status, refresh } = await useAsyncData('resident', async () => {
  const [cats, ledger] = await Promise.all([
    client.from('waste_categories').select('id,name,price_per_kg').eq('active', true).order('name'),
    client.from('savings_ledger').select('type,amount'),
  ])
  // ledger RLS already scopes rows to the owner
  return { cats: cats.data ?? [], ledger: ledger.data ?? [] }
})

const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const balance = computed(() => (data.value?.ledger ?? []).reduce((s, l) => s + (l.type === 'kredit' ? Number(l.amount) : -Number(l.amount)), 0))

const schema = z.object({ amount: z.number(t('resident.amountMin')).min(10000, t('resident.amountMin')) })
type Schema = z.output<typeof schema>
const state = reactive<Partial<Schema>>({ amount: undefined })
const sending = ref(false)

async function onWithdraw(event: FormSubmitEvent<Schema>) {
  sending.value = true
  const { error } = await client.from('withdrawals').insert({ resident_id: uid, amount: event.data.amount })
  sending.value = false
  if (error) {
    toast.add({ title: error.message, color: 'error' })
    return
  }
  state.amount = undefined
  toast.add({ title: t('resident.withdrawSent'), color: 'success' })
  await refresh()
}

// --- self-service weighing request -------------------------------------------
// The resident declares the weight; a petugas re-weighs it before it counts.
const categoryId = ref<number>()
// ponytail: a text field, not a number field — a number field parses with the app
// locale, so "2.3" (dot, what a keyboard gives you) landed as 23 kg (see cashier)
const weightText = ref('')
const items = ref<{ categoryId: number, name: string, weightKg: number, price: number, value: number }[]>([])
const submitting = ref(false)

const categoryItems = computed(() => (data.value?.cats ?? []).map(c => ({ label: `${c.name} · ${fmtRp.value.format(Number(c.price_per_kg))}${t('resident.perKg')}`, value: c.id })))
const total = computed(() => items.value.reduce((s, i) => s + i.value, 0))
const totalKg = computed(() => items.value.reduce((s, i) => s + i.weightKg, 0))

function addItem() {
  const cat = (data.value?.cats ?? []).find(c => c.id === categoryId.value)
  if (!cat) return
  const weightKgValue = parseWeightKg(weightText.value)
  if (!weightKgValue) {
    toast.add({ title: t('resident.needWeight'), color: 'warning' })
    return
  }
  const price = Number(cat.price_per_kg)
  items.value.push({ categoryId: cat.id, name: cat.name, weightKg: weightKgValue, price, value: Math.round(weightKgValue * price) })
  categoryId.value = undefined
  weightText.value = ''
}

function removeItem(idx: number) {
  items.value.splice(idx, 1)
}

async function submitDeposit() {
  if (!items.value.length) {
    toast.add({ title: t('resident.needItem'), color: 'warning' })
    return
  }
  submitting.value = true
  // Header first; if the lines fail, the request goes away again (own pending row)
  const { data: dep, error } = await client.from('deposits').insert({
    resident_id: uid,
    operator_id: uid,
    status: 'menunggu',
    // berat sebelum: what the resident declared, kept for the petugas to compare
    estimated_weight: totalKg.value,
    total_weight: totalKg.value,
    total_value: total.value,
  }).select('id').single()
  if (error || !dep) {
    submitting.value = false
    toast.add({ title: error?.message ?? 'Error', color: 'error' })
    return
  }
  const { error: itemsErr } = await client.from('deposit_items').insert(
    items.value.map(i => ({ deposit_id: dep.id, category_id: i.categoryId, category_name: i.name, weight_kg: i.weightKg, price_per_kg: i.price, value: i.value })),
  )
  if (itemsErr) {
    await client.from('deposits').delete().eq('id', dep.id)
    submitting.value = false
    toast.add({ title: itemsErr.message, color: 'error' })
    return
  }
  items.value = []
  submitting.value = false
  toast.add({ title: t('resident.depositSent'), color: 'success' })
  await refresh()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('resident.title')" />
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('resident.subtitle') }}</p>

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        <div class="flex flex-col gap-4">
          <UCard>
            <p class="text-sm font-semibold text-muted">{{ $t('resident.balance') }}</p>
            <p class="text-3xl font-extrabold tabular-nums mt-1">{{ loading ? '…' : fmtRp.format(balance) }}</p>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-bold">{{ $t('resident.withdraw') }}</h2>
            </template>
            <UForm :schema="schema" :state="state" class="space-y-3" @submit="onWithdraw">
              <UFormField name="amount" :label="$t('resident.amount')" required>
                <UInputNumber v-model="state.amount" :min="10000" :step="5000" :step-snapping="false" class="w-full" />
              </UFormField>
              <UButton type="submit" :loading="sending" :label="$t('resident.submitWithdraw')" block />
            </UForm>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-bold">{{ $t('resident.histories') }}</h2>
            </template>
            <div class="grid gap-2">
              <UButton
                to="/resident/weighings"
                icon="i-lucide-scale"
                color="neutral"
                variant="outline"
                :label="$t('resident.history')"
                block
              />
              <UButton
                to="/resident/withdrawals"
                icon="i-lucide-banknote"
                color="neutral"
                variant="outline"
                :label="$t('resident.withdrawHistory')"
                block
              />
            </div>
          </UCard>
        </div>

        <div class="flex flex-col gap-4">
          <UCard>
            <template #header>
              <h2 class="font-bold">{{ $t('resident.selfTitle') }}</h2>
            </template>
            <p class="text-sm text-muted mb-3">{{ $t('resident.selfSubtitle') }}</p>
            <div class="grid gap-3">
              <UFormField name="category" :label="$t('resident.category')">
                <USelectMenu
                  v-model="categoryId"
                  value-key="value"
                  :items="categoryItems"
                  :placeholder="$t('resident.pickCategory')"
                  searchable
                  class="w-full"
                />
              </UFormField>
              <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-end">
                <UFormField name="weight" :label="$t('resident.weightKg')">
                  <UInput v-model="weightText" inputmode="decimal" :placeholder="$t('resident.weightPlaceholder')" class="w-full" />
                </UFormField>
                <UButton icon="i-lucide-plus" :label="$t('resident.addItem')" @click="addItem" />
              </div>
              <ul v-if="items.length" class="grid gap-2">
                <li v-for="(it, idx) in items" :key="idx" class="flex items-center justify-between gap-2 text-sm">
                  <span>{{ it.name }} · <span class="tabular-nums">{{ fmtKg(it.weightKg) }}</span></span>
                  <span class="flex items-center gap-2">
                    <span class="font-bold tabular-nums">{{ fmtRp.format(it.value) }}</span>
                    <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="it.name" @click="removeItem(idx)" />
                  </span>
                </li>
              </ul>
              <div class="flex items-center justify-between gap-2 text-sm">
                <span class="text-muted">{{ $t('resident.total') }} · <span class="tabular-nums">{{ fmtKg(totalKg) }}</span></span>
                <span class="font-bold tabular-nums">{{ fmtRp.format(total) }}</span>
              </div>
              <UButton :label="$t('resident.submitDeposit')" :loading="submitting" :disabled="!items.length" block size="lg" @click="submitDeposit" />
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-bold">{{ $t('resident.prices') }}</h2>
            </template>
            <p v-if="!data?.cats.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
            <ul v-else class="grid gap-2">
              <li v-for="c in data.cats" :key="c.id" class="flex items-center justify-between text-sm">
                <span>{{ c.name }}</span>
                <span class="font-bold tabular-nums">{{ fmtRp.format(Number(c.price_per_kg)) }}{{ $t('resident.perKg') }}</span>
              </li>
            </ul>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
