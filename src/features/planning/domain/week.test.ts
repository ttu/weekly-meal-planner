import { fixedClock } from '@/shared/time/clock'
import { currentWeekStart, localToday, weekDates } from './week'
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
    expect(currentWeekStart(fixedClock('2026-08-30T20:59:00.000Z'))).toBe('2026-08-24')
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

// Finland is UTC+2 in November: 22:30Z on Sunday is already 00:30 Monday there.
// jest.global-setup.js pins the zone to Europe/Helsinki, so UTC-based code
// fails here on any machine.
describe('local day', () => {
  const clock = fixedClock('2026-11-01T22:30:00Z')

  it('takes the week start from the local day, not the UTC day', () => {
    expect(currentWeekStart(clock)).toBe('2026-11-02')
  })

  it('takes today from the local day, not the UTC day', () => {
    expect(localToday(clock)).toBe('2026-11-02')
  })
})
