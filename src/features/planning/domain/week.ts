import { brand } from '@/shared/types/brand'
import type { Clock } from '@/shared/time/clock'
import type { WeekStart } from './types'

const DAY_MS = 86_400_000

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10)

/**
 * Monday of the ISO week containing the clock's instant. getUTCDay() returns 0
 * for Sunday, which must map back six days, not forward one.
 */
export const currentWeekStart = (clock: Clock): WeekStart => {
  const now = clock.now()
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const daysSinceMonday = (new Date(utcMidnight).getUTCDay() + 6) % 7
  return brand(toIsoDate(new Date(utcMidnight - daysSinceMonday * DAY_MS)))
}

export const weekDates = (weekStart: WeekStart): readonly string[] => {
  const start = Date.parse(`${weekStart}T00:00:00.000Z`)
  return Array.from({ length: 7 }, (_, i) => toIsoDate(new Date(start + i * DAY_MS)))
}
