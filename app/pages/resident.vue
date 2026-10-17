<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['warga'] })

const { locale, t } = useI18n()
const uid = useMyId()
const client = useSupabaseClient<Database>()
const toast = useToast()

const tag = computed(() => (locale.value === 'id' ? 'id-ID' : 'en-US'))
const fmtRp = computed(() => new Intl.NumberFormat(tag.value, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }))
const fmtKg = (v: number) => `${new Intl.NumberFormat(tag.value, { maximumFractionDigits: 1 }).format(v)} kg`
const fmtDate = computed(() => new Intl.DateTimeFormat(tag.value, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }))

const { data, status, refresh } = await useAsyncData('resident', async () => {
  const [cats, deps, ledger, wds] = await Promise.all([
    client.from('waste_categories').select('id,name,price_per_kg').eq('active', true).order('name'),
    client.from('deposits').select('id,total_weight,total_value,deposited_at').eq('resident_id', uid).eq('status', 'tercatat').order('deposited_at', { ascending: false }).limit(20),
    client.from('savings_ledger').select('type,amount'),
    client.from('withdrawals').select('id,amount,status,created_at').eq('resident_id', uid).order('created_at', { ascending: false }).limit(20),
  ])
  // ledger RLS already scopes rows to the owner
  return { cats: cats.data ?? [], deps: deps.data ?? [], ledger: ledger.data ?? [], wds: wds.data ?? [] }
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

const statusColor = (s: string) => s === 'disetujui' ? 'success' : s === 'ditolak' ? 'error' : 'warning'
const statusLabel = (s: string) => s === 'disetujui' ? t('resident.approved') : s === 'ditolak' ? t('resident.rejected') : t('resident.pending')
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('resident.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
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
                <UInputNumber v-model="state.amount" :min="10000" :step="5000" class="w-full" />
              </UFormField>
              <UButton type="submit" :loading="sending" :label="$t('resident.submitWithdraw')" block />
            </UForm>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-bold">{{ $t('resident.withdrawHistory') }}</h2>
            </template>
            <p v-if="!data?.wds.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
            <ul v-else class="grid gap-2">
              <li v-for="w in data.wds" :key="w.id" class="flex items-center justify-between gap-2 text-sm">
                <span class="tabular-nums">{{ fmtRp.format(Number(w.amount)) }} · {{ fmtDate.format(new Date(w.created_at)) }}</span>
                <UBadge :color="statusColor(w.status)" variant="subtle">{{ statusLabel(w.status) }}</UBadge>
              </li>
            </ul>
          </UCard>
        </div>

        <div class="flex flex-col gap-4">
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

          <UCard>
            <template #header>
              <h2 class="font-bold">{{ $t('resident.history') }}</h2>
            </template>
            <p v-if="!data?.deps.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-wide text-muted">
                    <th class="py-2 pr-2">{{ $t('resident.colDate') }}</th>
                    <th class="py-2 pr-2">{{ $t('resident.colWeight') }}</th>
                    <th class="py-2">{{ $t('resident.colValue') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in data.deps" :key="d.id" class="border-t border-muted">
                    <td class="py-2 pr-2">{{ fmtDate.format(new Date(d.deposited_at)) }}</td>
                    <td class="py-2 pr-2 tabular-nums">{{ fmtKg(Number(d.total_weight)) }}</td>
                    <td class="py-2 tabular-nums">{{ fmtRp.format(Number(d.total_value)) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
