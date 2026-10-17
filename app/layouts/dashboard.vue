<script setup lang="ts">
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

interface NavItem {
  label: string
  icon: string
  to: string
}

const items = computed<NavItem[]>(() => {
  // ponytail: superadmin sees every menu (role gate still enforced per page)
  const all = role.value === 'superadmin'
  const main: NavItem[] = []
  if (role.value === 'pengurus_rw' || all) main.push({ label: t('nav.dashboard'), icon: 'i-lucide-chart-column', to: '/' })
  if (role.value === 'warga' || all) main.push({ label: t('nav.resident'), icon: 'i-lucide-house', to: '/resident' })
  if (role.value === 'petugas' || all) {
    main.push(
      { label: t('nav.cashier'), icon: 'i-lucide-scale', to: '/cashier' },
      { label: t('nav.prices'), icon: 'i-lucide-tags', to: '/cashier/prices' },
      { label: t('nav.payouts'), icon: 'i-lucide-badge-check', to: '/cashier/payouts' },
      { label: t('nav.shipments'), icon: 'i-lucide-truck', to: '/cashier/shipments' },
    )
  }
  if (role.value === 'pengepul' || all) main.push({ label: t('nav.handover'), icon: 'i-lucide-clipboard-check', to: '/handover' })
  if (role.value === 'pengurus_rw' || all) main.push({ label: t('nav.report'), icon: 'i-lucide-file-down', to: '/report' })
  if (role.value === 'superadmin') main.push({ label: t('nav.users'), icon: 'i-lucide-users', to: '/admin/users' })
  return main
})

async function logout() {
  await useSupabaseClient().auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      collapsible
      class="!border-0 bg-gradient-to-b from-emerald-950 to-emerald-700 text-emerald-50"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 font-extrabold text-white">
          <span class="grid size-8 shrink-0 place-items-center rounded-xl bg-white/20" aria-hidden="true">♻</span>
          <span v-if="!collapsed">{{ $t('brandShort') }}</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <nav :aria-label="$t('brandShort')">
          <ul class="grid gap-1">
            <li v-for="it in items" :key="it.to">
              <NuxtLink
                :to="it.to"
                class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-100 hover:bg-white/10 hover:text-white"
                active-class="bg-white/20 !text-white"
                :class="collapsed ? 'justify-center px-0' : ''"
              >
                <UIcon :name="it.icon" class="size-5 shrink-0" />
                <span v-if="!collapsed" class="truncate">{{ it.label }}</span>
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </template>

      <template #footer="{ collapsed }">
        <div class="flex w-full flex-col gap-2">
          <USelect
            v-if="!collapsed"
            :model-value="locale"
            :items="locales.map(l => ({ label: l.name, value: l.code }))"
            :aria-label="$t('common.language')"
            size="sm"
            class="w-full"
            @update:model-value="code => setLocale(code as 'id' | 'en')"
          />
          <div v-if="!collapsed" class="rounded-2xl bg-white/10 p-4 text-sm">
            <strong class="block truncate text-white">{{ profile?.full_name }}</strong>
            <UButton
              :label="$t('common.logout')"
              color="neutral"
              variant="ghost"
              block
              class="mt-3 !bg-white/20 text-white hover:!bg-white/30"
              @click="logout"
            />
          </div>
          <UButton
            v-else
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            class="text-white hover:bg-white/10"
            :aria-label="$t('common.logout')"
            @click="logout"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
