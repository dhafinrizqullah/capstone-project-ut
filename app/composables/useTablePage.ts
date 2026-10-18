import { computed, ref, watch } from 'vue'

/**
 * Search + pagination for a list page's rows.
 *
 * ponytail: every caller already fetches its whole (RW-scale) list, so this only
 * filters and slices it in the browser. When a table outgrows one fetch, move the
 * search into the query (`.ilike` + `.range`) and keep this for the slice.
 */
export function useTablePage<T>(
  rows: Readonly<Ref<readonly T[] | undefined>>,
  match: (row: T, term: string) => boolean,
  pageSize = 10,
) {
  const search = ref('')
  const page = ref(1)

  const filtered = computed(() => {
    const term = search.value.trim().toLowerCase()
    const list = rows.value ?? []
    return term ? list.filter(row => match(row, term)) : list
  })
  const total = computed(() => filtered.value.length)
  const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

  // a new search is a new result set: start it at page 1
  watch(search, () => { page.value = 1 })

  return { search, page, pageSize, paged, total }
}
