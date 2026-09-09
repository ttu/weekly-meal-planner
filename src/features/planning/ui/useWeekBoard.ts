import { useQuery } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import { currentWeekStart } from '../domain/week'
import { buildBoard, type BoardDay } from '../domain/board'
import { loadWeek } from '../infrastructure/board-repository'
import { loadBacklog } from '../infrastructure/backlog-repository'
import type { BacklogItem, WeekStart } from '../domain/types'

export type WeekBoard = {
  readonly board: readonly BoardDay[]
  readonly backlog: readonly BacklogItem[]
  readonly weekStart: WeekStart
  readonly householdName: string
  readonly isLoading: boolean
}

/**
 * Server state lives in TanStack Query and nowhere else; client state (which day
 * is scrolled to, sheet open) stays in component state. They never mix.
 */
export const useWeekBoard = (clock: Clock = systemClock): WeekBoard => {
  const { client, household } = useSession()
  const weekStart = currentWeekStart(clock)

  const { data, isLoading } = useQuery({
    queryKey: ['week', household?.id, weekStart],
    enabled: household !== undefined,
    queryFn: async () => {
      const result = await loadWeek(client, weekStart)
      // A Week Plan that does not exist yet is an expected outcome, not an
      // error: nobody has planned this week. Render an empty board.
      if (isErr(result)) return { cookEvents: [], leftovers: [], backlog: [] }

      const backlog = await loadBacklog(client, result.value.weekPlanId)
      return {
        ...result.value,
        backlog: isErr(backlog) ? [] : backlog.value,
      }
    },
  })

  return {
    board: buildBoard({
      weekStart,
      slots: household?.slots ?? [],
      cookEvents: data?.cookEvents ?? [],
      leftovers: data?.leftovers ?? [],
    }),
    backlog: data?.backlog ?? [],
    weekStart,
    householdName: household?.name ?? '',
    isLoading: isLoading || household === undefined,
  }
}
