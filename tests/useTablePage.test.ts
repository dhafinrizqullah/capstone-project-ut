import { describe, expect, test } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useTablePage } from '../app/composables/useTablePage'

type Row = { name: string }

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Row ${String(i + 1).padStart(2, '0')}` }))

const byName = (row: Row, term: string) => row.name.toLowerCase().includes(term)

describe('useTablePage', () => {
  test('slices ten rows per page', async () => {
    const source = ref<Row[]>(rows(25))
    const { page, pageSize, paged, total } = useTablePage(source, byName)

    expect(pageSize).toBe(10)
    expect(total.value).toBe(25)
    expect(paged.value).toHaveLength(10)

    page.value = 3
    await nextTick()
    expect(paged.value).toHaveLength(5)
    expect(paged.value[0]!.name).toBe('Row 21')
  })

  test('filters on the term and returns to page 1', async () => {
    const source = ref<Row[]>(rows(25))
    const { search, page, paged, total } = useTablePage(source, byName)

    page.value = 3
    await nextTick()

    search.value = 'row 2'
    await nextTick()
    expect(page.value).toBe(1)
    // Row 20..25 (names are zero-padded, so "Row 02" does not match)
    expect(total.value).toBe(6)
    expect(paged.value.map(r => r.name)).toContain('Row 22')
    expect(paged.value.some(r => r.name === 'Row 01')).toBe(false)
  })

  test('reads a computed source and tolerates undefined', async () => {
    const source = ref<Row[] | undefined>(undefined)
    const { paged, total } = useTablePage(computed(() => source.value), byName)

    expect(total.value).toBe(0)
    expect(paged.value).toHaveLength(0)

    source.value = rows(3)
    await nextTick()
    expect(total.value).toBe(3)
  })
})
