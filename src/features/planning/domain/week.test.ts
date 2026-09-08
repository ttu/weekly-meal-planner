import { fixedClock } from '@/shared/time/clock'
import { currentWeekStart, weekDates } from './week'
import type { WeekStart } from './types'

describe('currentWeekStart', () => {
  it('returns Monday when today is mid-week', () => {
    expect(currentWeekStart(fixedClock('2026-08-26T09:00:00.000Z'))).toBe('2026-08-24')
  })

  it('returns today when today is Monday', () => {
    expect(currentWeekStart(fixedClock('2026-08-24T00:30:00.000Z'))).toBe('2026-08-24')
  })

  // The case that matters: a naive getDay() implementation returns the *next*
  // Monday on Sundays, silently showing an empty week to a family planning on
  // Sunday evening — the most likely moment they open the app.
  it('returns the Monday six days back when today is Sunday', () => {
    expect(currentWeekStart(fixedClock('2026-08-30T23:59:00.000Z'))).toBe('2026-08-24')
  })
})

describe('weekDates', () => {
  it('returns seven consecutive ISO dates from Monday', () => {
    expect(weekDates('2026-08-24' as WeekStart)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ])
  })

  it('crosses a month boundary correctly', () => {
    expect(weekDates('2026-08-31' as WeekStart)[6]).toBe('2026-09-06')
  })
})
