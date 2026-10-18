import type { Ref } from 'vue'
import { computed, onScopeDispose, ref, watch } from 'vue'

export interface ListQuery {
  /** 1-based page index. */
  page: number
  pageSize: number
  /** Debounced search term; empty means "no search". */
  term: string
  /** Jakarta-day window as UTC instants, already nulled out while searching. */
  from: string | null
  to: string | null
}

export interface ListResult<T> {
  rows: T[]
  /** Matching row count across every page (Supabase `count: 'exact'`). */
  total: number
}

/**
 * Search + date range + server-side pagination for a list page.
 *
 * The fetcher owns the query and must use `.range()` + `{ count: 'exact' }`; this
 * composable only holds the criteria and refetches when they change. A search term
 * deliberately drops the date window: searching looks at the whole table.
 *
 * ponytail: pagination is a `useAsyncData` per settable criterion, not a cache —
 * RW-scale tables do not need one.
 */
export function useListPage<T>(opts: {
  key: string
  fetch: (q: ListQuery) => Promise<ListResult<T>>
  pageSize?: number
  /** Extra criteria the fetcher reads (status filter…); changing one refetches and resets the page. */
  extra?: Ref<unknown> | Ref<unknown>[]
}) {
  const pageSize = opts.pageSize ?? 10
  const search = ref('')
  const term = ref('')
  const page = ref(1)
  const { preset, fromDate, toDate, from, to } = useDateRange()

  // typing is not a query per keystroke: wait for a pause before refetching
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(search, (v) => {
    clearTimeout(timer)
    timer = setTimeout(() => { term.value = v.trim() }, 300)
  })
  onScopeDispose(() => clearTimeout(timer))

  const extra = opts.extra ? (Array.isArray(opts.extra) ? opts.extra : [opts.extra]) : []

  // a new term, window or filter is a new result set: back to the first page
  watch([term, from, to, ...extra], () => { page.value = 1 })

  const { data, status, refresh } = useAsyncData(opts.key, () => opts.fetch({
    page: page.value,
    pageSize,
    term: term.value,
    from: term.value ? null : from.value,
    to: term.value ? null : to.value,
  }), { watch: [page, term, from, to, ...extra] })

  return {
    search, page, pageSize, preset, fromDate, toDate,
    rows: computed(() => data.value?.rows ?? []),
    total: computed(() => data.value?.total ?? 0),
    loading: computed(() => status.value === 'pending' || status.value === 'idle'),
    refresh,
  }
}
