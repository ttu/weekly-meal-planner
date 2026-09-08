import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import { currentWeekStart } from '../domain/week'
import { buildBoard, type BoardDay } from '../domain/board'
import { demoWeek } from '../fixtures/demo-week'
import type { WeekStart } from '../domain/types'

export type WeekBoard = {
  readonly board: readonly BoardDay[]
  readonly weekStart: WeekStart
  readonly householdName: string
  readonly isLoading: boolean
}

/**
 * The Household comes from Postgres; the week's contents are still fixtures
 * until Task 7. This signature does not change when they are substituted.
 */
export const useWeekBoard = (clock: Clock = systemClock): WeekBoard => {
  const { household } = useSession()
  const weekStart = currentWeekStart(clock)
  const { cookEvents, leftovers } = demoWeek(clock)

  return {
    board: buildBoard({ weekStart, slots: household?.slots ?? [], cookEvents, leftovers }),
    weekStart,
    householdName: household?.name ?? '',
    isLoading: household === undefined,
  }
}
