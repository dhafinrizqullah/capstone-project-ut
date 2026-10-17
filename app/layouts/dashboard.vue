<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

const { locale, locales, setLocale, t } = useI18n()
const user = useSupabaseUser()
const client = useSupabaseClient<Database>()
const { data: profile } = await useAsyncData('my-profile', async () => {
  const uid = (user.value as unknown as { sub: string } | null)?.sub
  if (!uid) return null
  const { data } = await client
    .from('profiles')
    .select('full_name, role')
    .eq('id', uid)
    .maybeSingle()
  return data
})

const role = computed(() => profile.value?.role)

const items = computed<NavigationMenuItem[][]>(() => {
  const main: NavigationMenuItem[] = []
  if (role.value === 'pengurus_rw') main.push({ label: t('nav.dashboard'), icon: 'i-lucide-chart-column', to: '/' })
  if (role.value === 'warga') main.push({ label: t('nav.resident'), icon: 'i-lucide-house', to: '/resident' })
  if (role.value === 'petugas') {
    main.push(
      { label: t('nav.cashier'), icon: 'i-lucide-scale', to: '/cashier' },
      { label: t('nav.prices'), icon: 'i-lucide-tags', to: '/cashier/prices' },
      { label: t('nav.payouts'), icon: 'i-lucide-badge-check', to: '/cashier/payouts' },
      { label: t('nav.shipments'), icon: 'i-lucide-truck', to: '/cashier/shipments' },
    )
  }
  if (role.value === 'pengepul') main.push({ label: t('nav.handover'), icon: 'i-lucide-clipboard-check', to: '/handover' })
  if (role.value === 'pengurus_rw') main.push({ label: t('nav.report'), icon: 'i-lucide-file-down', to: '/report' })
  if (role.value === 'superadmin') main.push({ label: t('nav.users'), icon: 'i-lucide-users', to: '/admin/users' })
  return [main]
})

async function logout() {
  await useSupabaseClient().auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible>
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 font-extrabold">
          <span class="grid size-8 place-items-center rounded-lg bg-primary/15" aria-hidden="true">♻</span>
          <span v-if="!collapsed">{{ $t('brandShort') }}</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :items="items" orientation="vertical" />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex flex-col gap-2">
          <USelect
            :model-value="locale"
            :items="locales.map(l => ({ label: l.name, value: l.code }))"
            :aria-label="$t('common.language')"
            size="sm"
            @update:model-value="code => setLocale(code as 'id' | 'en')"
          />
          <p v-if="!collapsed" class="truncate text-sm font-semibold">{{ profile?.full_name }}</p>
          <UButton
            :icon="collapsed ? 'i-lucide-log-out' : undefined"
            :label="collapsed ? undefined : $t('common.logout')"
            color="neutral"
            variant="ghost"
            block
            @click="logout"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
