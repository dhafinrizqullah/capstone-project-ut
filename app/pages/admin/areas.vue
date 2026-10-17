<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['superadmin'] })

const { t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

const { data: areaRows, refresh } = await useAsyncData('admin-areas', async () => {
  const { data } = await client.from('areas').select('id,rw,rt').order('rw').order('rt')
  return data ?? []
})

const newRw = ref('')
const newRt = ref('')
const saving = ref(false)

async function addArea() {
  if (!newRw.value.trim() || !newRt.value.trim()) return
  saving.value = true
  const { error } = await client.from('areas').insert({ rw: newRw.value.trim(), rt: newRt.value.trim() })
  saving.value = false
  if (error) {
    toast.add({ title: error.code === '23505' ? `${newRw.value} · ${newRt.value}` : error.message, color: 'error' })
    return
  }
  newRw.value = ''
  newRt.value = ''
  toast.add({ title: t('areas.saved'), color: 'success' })
  await refresh()
}

async function deleteArea(id: number) {
  const { error } = await client.from('areas').delete().eq('id', id)
  if (error) {
    toast.add({ title: error.code === '23503' ? t('areas.inUse') : error.message, color: 'error' })
    return
  }
  toast.add({ title: t('areas.deleted'), color: 'success' })
  await refresh()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('areas.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">{{ $t('areas.subtitle') }}</p>
      <UCard>
        <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:items-end mb-3">
          <UFormField name="newRw" :label="$t('areas.rw')">
            <UInput v-model="newRw" placeholder="RW 05…" class="w-full" />
          </UFormField>
          <UFormField name="newRt" :label="$t('areas.rt')">
            <UInput v-model="newRt" placeholder="RT 01…" class="w-full" />
          </UFormField>
          <UButton icon="i-lucide-plus" :label="$t('areas.add')" :loading="saving" @click="addArea" />
        </div>
        <ul class="grid gap-1">
          <li v-for="a in areaRows ?? []" :key="a.id" class="flex items-center justify-between gap-2 text-sm py-1.5 border-t border-muted">
            <span class="font-semibold">{{ a.rw }} · {{ a.rt }}</span>
            <UButton
              icon="i-lucide-trash"
              color="error"
              variant="ghost"
              size="xs"
              :aria-label="`${a.rw} ${a.rt}`"
              @click="deleteArea(a.id)"
            />
          </li>
        </ul>
        <p v-if="!areaRows?.length" class="text-sm text-muted">{{ $t('common.empty') }}</p>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
