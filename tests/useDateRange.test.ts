import { describe, expect, test } from 'vitest'
import { dayEnd, dayStart, jakartaDay, presetBounds } from '../app/composables/useDateRange'

const TODAY = '2026-10-18'

describe('presetBounds', () => {
  test('this month runs from the 1st to today', () => {
    expect(presetBounds('this_month', TODAY, '', '')).toEqual({ from: '2026-10-01', to: TODAY })
  })

  test('last 3 months starts on the month two back', () => {
    expect(presetBounds('last_3_months', TODAY, '', '')).toEqual({ from: '2026-08-01', to: TODAY })
  })

  test('last 3 months rolls the year back', () => {
    expect(presetBounds('last_3_months', '2026-01-15', '', '')).toEqual({ from: '2025-11-01', to: '2026-01-15' })
  })

  test('this/last year cover whole calendar years', () => {
    expect(presetBounds('this_year', TODAY, '', '')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(presetBounds('last_year', TODAY, '', '')).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })

  test('all time has no bounds', () => {
    expect(presetBounds('all', TODAY, '', '')).toBeNull()
  })

  test('custom needs both ends, otherwise it falls back to no window', () => {
    expect(presetBounds('custom', TODAY, '2026-03-01', '2026-03-31')).toEqual({ from: '2026-03-01', to: '2026-03-31' })
    expect(presetBounds('custom', TODAY, '2026-03-01', '')).toBeNull()
  })
})

describe('Jakarta day boundaries', () => {
  test('boundaries are the Jakarta day, not the browser day', () => {
    // 00:00 Jakarta on the 18th is 17:00 UTC on the 17th
    expect(dayStart('2026-10-18')).toBe('2026-10-17T17:00:00.000Z')
    // end of day is inclusive: 23:59:59.999 Jakarta
    expect(dayEnd('2026-10-18')).toBe('2026-10-18T16:59:59.999Z')
  })

  test('a UTC-instant near midnight still reads the Jakarta calendar date', () => {
    // 2026-10-17T20:00Z is 2026-10-18T03:00 Jakarta
    expect(jakartaDay(new Date('2026-10-17T20:00:00Z'))).toBe('2026-10-18')
  })
})
