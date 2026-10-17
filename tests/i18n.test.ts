import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(__dirname, '..', 'i18n', 'locales')
const flat = (obj: unknown, prefix = ''): string[] =>
  Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )

describe('i18n locales', () => {
  it('id and en expose identical key sets (no raw KEY shown in UI)', () => {
    const id = flat(JSON.parse(readFileSync(join(dir, 'id.json'), 'utf8'))).sort()
    const en = flat(JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8'))).sort()
    expect(en).toEqual(id)
  })
})
