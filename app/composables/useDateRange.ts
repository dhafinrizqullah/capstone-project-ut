import { computed, ref } from 'vue'

export type DatePreset = 'this_month' | 'last_3_months' | 'this_year' | 'last_year' | 'all' | 'custom'

// Asia/Jakarta is a fixed +07:00 (no DST), so a civil date maps to one exact instant.
export const JAKARTA_OFFSET = '+07:00'

/** `YYYY-MM-DD` for `at`, read on the Jakarta wall clock. */
export function jakartaDay(at: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at)
}

/**
 * Inclusive Jakarta civil-day window for a preset. Pure, so the boundaries can be
 * tested without a clock: `today` is injected.
 */
export function presetBounds(
  preset: DatePreset,
  today: string,
  customFrom: string,
  customTo: string,
): { from: string, to: string } | null {
  const year = Number(today.slice(0, 4))
  switch (preset) {
    case 'this_month':
      return { from: `${today.slice(0, 7)}-01`, to: today }
    // the current month plus the two before it
    case 'last_3_months':
      return { from: new Date(Date.UTC(year, Number(today.slice(5, 7)) - 3, 1)).toISOString().slice(0, 10), to: today }
    case 'this_year':
      return { from: `${year}-01-01`, to: `${year}-12-31` }
    case 'last_year':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
    case 'custom':
      return customFrom && customTo ? { from: customFrom, to: customTo } : null
    case 'all':
      return null
  }
}

/** First instant of a Jakarta civil day, as a UTC ISO string for `timestamptz` filters. */
export const dayStart = (iso: string) => new Date(`${iso}T00:00:00${JAKARTA_OFFSET}`).toISOString()
/** Last instant of a Jakarta civil day (inclusive upper bound). */
export const dayEnd = (iso: string) => new Date(`${iso}T23:59:59.999${JAKARTA_OFFSET}`).toISOString()

/**
 * The date window a list page queries with. `preset`/`fromDate`/`toDate` are the
 * inputs (bound to `DateRangeFilter`); `from`/`to` are the ready-to-use bounds.
 *
 * ponytail: `today` is read once per component — a tab left open across midnight
 * keeps yesterday's window. Moving it to a timer is not worth a watcher per page.
 */
export function useDateRange() {
  const preset = ref<DatePreset>('this_year')
  const today = jakartaDay()
  const fromDate = ref(`${today.slice(0, 4)}-01-01`)
  const toDate = ref(today)

  const bounds = computed(() => presetBounds(preset.value, today, fromDate.value, toDate.value))
  const from = computed(() => (bounds.value ? dayStart(bounds.value.from) : null))
  const to = computed(() => (bounds.value ? dayEnd(bounds.value.to) : null))

  return { preset, fromDate, toDate, from, to }
}
