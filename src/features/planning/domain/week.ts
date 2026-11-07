import { brand } from '@/shared/types/brand'
import type { Clock } from '@/shared/time/clock'
import type { WeekStart } from './types'

const DAY_MS = 86_400_000

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10)

/**
 * The household's calendar day for the clock's instant, as an ISO date. Read
 * from the local getters: in Finland, 00:30 Monday is still Sunday in UTC.
 */
export const localToday = (clock: Clock): string => {
  const now = clock.now()
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

/**
 * Monday of the ISO week containing the local day. getUTCDay() on the
 * date-only value returns 0 for Sunday, which must map back six days.
 */
export const currentWeekStart = (clock: Clock): WeekStart => {
  const today = Date.parse(`${localToday(clock)}T00:00:00.000Z`)
  const daysSinceMonday = (new Date(today).getUTCDay() + 6) % 7
  return brand(toIsoDate(new Date(today - daysSinceMonday * DAY_MS)))
}

/**
 * The Monday `offset` weeks from this one. Zero is this week, 1 is next.
 *
 * Planning happens for the week ahead at least as often as for the one
 * underway — on a Sunday evening "this week" is nearly over — and until this
 * existed the board could only ever show the current seven days.
 */
export const weekStartFrom = (clock: Clock, offset: number): WeekStart => {
  const start = Date.parse(`${currentWeekStart(clock)}T00:00:00.000Z`)
  return brand(toIsoDate(new Date(start + offset * 7 * DAY_MS)))
}

export const weekDates = (weekStart: WeekStart): readonly string[] => {
  const start = Date.parse(`${weekStart}T00:00:00.000Z`)
  return Array.from({ length: 7 }, (_, i) => toIsoDate(new Date(start + i * DAY_MS)))
}
