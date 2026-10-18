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
      { label: t('nav.verify'), icon: 'i-lucide-clipboard-list', to: '/cashier/verify' },
      { label: t('nav.prices'), icon: 'i-lucide-tags', to: '/cashier/prices' },
      { label: t('nav.payouts'), icon: 'i-lucide-badge-check', to: '/cashier/payouts' },
      { label: t('nav.shipments'), icon: 'i-lucide-truck', to: '/cashier/shipments' },
    )
  }
  if (role.value === 'pengepul' || all) main.push({ label: t('nav.handover'), icon: 'i-lucide-clipboard-check', to: '/handover' })
  // pengurus_rw may read the price master, but has no cashier menu of its own
  if (role.value === 'pengurus_rw') main.push({ label: t('nav.prices'), icon: 'i-lucide-tags', to: '/cashier/prices' })
  if (role.value === 'pengurus_rw' || all) main.push({ label: t('nav.report'), icon: 'i-lucide-file-down', to: '/report' })
  if (role.value === 'superadmin') {
    main.push(
      { label: t('nav.users'), icon: 'i-lucide-users', to: '/admin/users' },
      { label: t('nav.areas'), icon: 'i-lucide-map-pin', to: '/admin/areas' },
    )
  }
  return main
})

// ponytail: two locales = a sliding segmented switch, not a dropdown
// (the pill is half the track minus p-1; a third locale needs a measured pill)
const localeIndex = computed(() => (locales.value ?? []).findIndex(l => l.code === locale.value))
const otherLocale = computed(() => (locales.value ?? []).find(l => l.code !== locale.value))

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
      :ui="{
        // ponytail: the theme ships no width transition — a collapsed rail that
        // jumps reads as a glitch. overflow-hidden keeps growing labels inside.
        root: 'overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none',
        // body is overflow-y-auto, which computes overflow-x to auto too — while the rail animates
        // its width, the nav is still laid out at full size and the OS paints a horizontal
        // scrollbar above the footer (a white bar). Clip instead of scroll.
        body: 'overflow-x-hidden',
        content: 'bg-gradient-to-b from-emerald-950 to-emerald-700 text-emerald-50',
        // ponytail: the slideover close X inherits neutral ghost colours — dark on the emerald gradient
        toggle: 'shrink-0 text-white hover:bg-white/10 hover:text-white',
      }"
    >
      <template #header="{ collapsed }">
        <!-- the control lives with the thing it collapses; the navbar keeps its own
             (mobile-only) drawer toggle. No logo box: at 15% sidebar width a boxed
             emoji mark squeezed the brand into "Bank Sa…" -->
        <div class="flex w-full items-center" :class="collapsed ? 'justify-center gap-0' : 'gap-1.5'">
          <UIcon
            name="i-lucide-recycle"
            class="size-5 shrink-0 overflow-hidden text-emerald-50 transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none"
            :class="collapsed ? 'max-w-0 opacity-0' : 'max-w-5 opacity-100'"
            aria-hidden="true"
          />
          <span
            class="truncate text-sm font-extrabold text-white transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none"
            :class="collapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'"
          >{{ $t('brandShort') }}</span>
          <UDashboardSidebarCollapse
            :class="collapsed
              ? 'text-emerald-50 hover:bg-white/10 hover:text-white'
              : 'ms-auto text-emerald-50 hover:bg-white/10 hover:text-white'"
          />
        </div>
      </template>

      <template #default="{ collapsed }">
        <nav :aria-label="$t('brandShort')">
          <ul class="grid gap-1">
            <li v-for="it in items" :key="it.to">
              <NuxtLink
                :to="it.to"
                class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-50 transition-colors duration-200 hover:bg-white/10 hover:text-white motion-reduce:transition-none"
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
          <!-- One tap, no dropdown: two locales fit side by side.
               ponytail: the rail animates its width only, so a row that mounts instantly paints at
               its final width and the white pill gets sheared at the moving edge — fade the swap
               in, so the rail's edge stays the only thing that moves. -->
          <Transition
            mode="out-in"
            enter-active-class="transition-opacity duration-300 ease-out motion-reduce:transition-none"
            enter-from-class="opacity-0"
          >
            <div v-if="!collapsed" class="flex items-center gap-1.5">
              <div
                class="relative flex flex-1 rounded-xl bg-white/10 p-1 text-xs font-semibold"
                role="group"
                :aria-label="$t('common.language')"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
                  :style="{ transform: `translateX(${localeIndex * 100}%)` }"
                />
                <button
                  v-for="l in locales"
                  :key="l.code"
                  type="button"
                  class="relative flex-1 rounded-lg px-2 py-1.5 transition-colors duration-200 motion-reduce:transition-none"
                  :class="locale === l.code ? 'text-emerald-900' : 'text-emerald-100 hover:text-white'"
                  :aria-pressed="locale === l.code"
                  @click="setLocale(l.code)"
                >
                  {{ l.name }}
                </button>
              </div>
              <UColorModeButton class="text-emerald-50 hover:bg-white/10 hover:text-white" />
            </div>
            <div v-else class="flex flex-col items-center gap-2">
              <UButton
                icon="i-lucide-globe"
                color="neutral"
                variant="ghost"
                class="text-white hover:bg-white/10"
                :aria-label="$t('common.language')"
                :title="`${$t('common.language')}: ${otherLocale?.name}`"
                @click="setLocale(otherLocale?.code ?? 'id')"
              />
              <UColorModeButton class="text-emerald-50 hover:bg-white/10 hover:text-white" />
            </div>
          </Transition>

          <Transition
            mode="out-in"
            enter-active-class="transition-opacity duration-300 ease-out motion-reduce:transition-none"
            enter-from-class="opacity-0"
          >
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
          </Transition>
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
