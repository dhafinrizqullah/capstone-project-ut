<script setup lang="ts">
import type { DatePreset } from '~/composables/useDateRange'

const { t } = useI18n()
const preset = defineModel<DatePreset>('preset', { required: true })
const fromDate = defineModel<string>('from', { required: true })
const toDate = defineModel<string>('to', { required: true })

const items = computed<{ label: string, value: DatePreset }[]>(() => [
  { label: t('dateRange.thisMonth'), value: 'this_month' },
  { label: t('dateRange.last3Months'), value: 'last_3_months' },
  { label: t('dateRange.thisYear'), value: 'this_year' },
  { label: t('dateRange.lastYear'), value: 'last_year' },
  { label: t('dateRange.all'), value: 'all' },
  { label: t('dateRange.custom'), value: 'custom' },
])
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <USelect
      v-model="preset"
      :items="items"
      value-key="value"
      :aria-label="t('dateRange.label')"
      class="w-full sm:w-44"
    />
    <template v-if="preset === 'custom'">
      <UInput
        v-model="fromDate"
        type="date"
        :aria-label="t('dateRange.from')"
        class="w-full sm:w-40"
      />
      <UInput
        v-model="toDate"
        type="date"
        :aria-label="t('dateRange.to')"
        class="w-full sm:w-40"
      />
    </template>
  </div>
</template>
