import { systemClock, type Clock } from '@/shared/time/clock'
import { currentWeekStart } from '../domain/week'
import { buildBoard, type BoardDay } from '../domain/board'
import { demoHousehold, demoWeek } from '../fixtures/demo-week'
import type { WeekStart } from '../domain/types'

export type WeekBoard = {
  readonly board: readonly BoardDay[]
  readonly weekStart: WeekStart
  readonly householdName: string
  readonly isLoading: boolean
}

/**
 * Fixture-backed. Task 5 substitutes the Household from Postgres and Task 7 the
 * week's contents; this signature does not change.
 */
export const useWeekBoard = (clock: Clock = systemClock): WeekBoard => {
  const weekStart = currentWeekStart(clock)
  const { cookEvents, leftovers } = demoWeek(clock)

  return {
    board: buildBoard({ weekStart, slots: demoHousehold.slots, cookEvents, leftovers }),
    weekStart,
    householdName: demoHousehold.name,
    isLoading: false,
  }
}
