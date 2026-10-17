<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: ['superadmin'] })

const { t } = useI18n()
const client = useSupabaseClient<Database>()
const toast = useToast()

const { data: areaRows, refresh } = await useAsyncData('admin-areas', async () => {
  const { data } = await client.from('areas').select('id,rw,rt').order('rw').order('rt')
  return data ?? []
})

const open = ref(false)
const schema = z.object({
  rw: z.string().trim().min(1),
  rt: z.string().trim().min(1),
})
type Schema = z.output<typeof schema>
const state = reactive<Schema>({ rw: '', rt: '' })
const saving = ref(false)

function openNew() {
  state.rw = ''
  state.rt = ''
  open.value = true
}

async function onSave(event: FormSubmitEvent<Schema>) {
  saving.value = true
  const { error } = await client.from('areas').insert(event.data)
  saving.value = false
  if (error) {
    toast.add({ title: error.code === '23505' ? `${event.data.rw} · ${event.data.rt}` : error.message, color: 'error' })
    return
  }
  open.value = false
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
      <UDashboardNavbar :title="$t('areas.title')" />
    </template>

    <template #body>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p class="text-sm text-muted">{{ $t('areas.subtitle') }}</p>
        <UButton class="self-start sm:self-auto" icon="i-lucide-plus" :label="$t('areas.add')" @click="openNew" />
      </div>
      <UCard>
        <ul class="grid gap-1">
          <li v-for="a in areaRows ?? []" :key="a.id" class="flex items-center justify-between gap-2 text-sm py-1.5 border-t border-muted first:border-t-0">
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

      <UModal v-model:open="open" :title="$t('areas.add')" :ui="{ footer: 'justify-end' }">
        <template #body>
          <UForm id="area-form" :schema="schema" :state="state" class="space-y-4" @submit="onSave">
            <UFormField name="rw" :label="$t('areas.rw')" required>
              <UInput v-model="state.rw" placeholder="RW 05…" class="w-full" />
            </UFormField>
            <UFormField name="rt" :label="$t('areas.rt')" required>
              <UInput v-model="state.rt" placeholder="RT 01…" class="w-full" />
            </UFormField>
          </UForm>
        </template>
        <template #footer="{ close }">
          <UButton :label="$t('common.cancel')" color="neutral" variant="outline" @click="close" />
          <UButton type="submit" form="area-form" :label="$t('areas.add')" :loading="saving" />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
