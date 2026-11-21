import { useMemo } from 'react'
import { systemClock, type Clock } from '@/shared/time/clock'
import { readMembers, useBoardSession } from '@/features/household'
import { mealIndex } from '@/features/meals'
import { useData, useView } from '@/features/sync'
import { readWeek } from '../application/planning-data'
import { buildBoard, type BoardDay } from '../domain/board'
import type { BacklogItem, WeekStart } from '../domain/types'
import { useSelectedWeek } from './SelectedWeek'

export type WeekBoard = {
  readonly board: readonly BoardDay[]
  readonly backlog: readonly BacklogItem[]
  readonly weekStart: WeekStart
  readonly householdName: string
  readonly isLoading: boolean
  /** The device has looked for its board, so an empty week really is empty. */
  readonly hasData: boolean
}

/** The week on screen, read from the synced board. */
export const useWeekBoard = (clock: Clock = systemClock): WeekBoard => {
  const { household, checked } = useBoardSession()
  const data = useData()
  const view = useView()
  const { weekStart } = useSelectedWeek(clock)

  const week = useMemo(() => {
    if (!household || !data || !view) return { cookEvents: [], leftovers: [], backlog: [] }
    const members = new Map(
      readMembers(view, data).map((m) => [m.id, { name: m.displayName, colour: m.colour }]),
    )
    return readWeek(data, weekStart, mealIndex(data, household.id, household.locale), members)
    // `view` changes whenever the board does, which is when the rows may have.
  }, [household, data, view, weekStart])

  return {
    board: buildBoard({
      weekStart,
      slots: household?.slots ?? [],
      cookEvents: week.cookEvents,
      leftovers: week.leftovers,
    }),
    backlog: week.backlog,
    weekStart,
    householdName: household?.name ?? '',
    isLoading: !checked,
    hasData: checked,
  }
}
