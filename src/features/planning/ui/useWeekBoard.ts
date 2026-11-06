import { useQuery } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import { buildBoard, type BoardDay } from '../domain/board'
import { loadWeek } from '../infrastructure/board-repository'
import { loadBacklog } from '../infrastructure/backlog-repository'
import type { BacklogItem, WeekStart } from '../domain/types'
import { useSelectedWeek } from './SelectedWeek'

export type WeekBoard = {
  readonly board: readonly BoardDay[]
  readonly backlog: readonly BacklogItem[]
  readonly weekPlanId: string | undefined
  readonly weekStart: WeekStart
  readonly householdName: string
  readonly isLoading: boolean
  /** The last load failed. With `hasData` this is a refresh that failed over a
   *  board still worth showing; without it, there is no board to show. */
  readonly isError: boolean
  /** An answer has arrived, so an empty board really is empty. */
  readonly hasData: boolean
  readonly refetch: () => void
}

/**
 * Server state lives in TanStack Query and nowhere else; client state (which day
 * is scrolled to, sheet open) stays in component state. They never mix.
 */
export const useWeekBoard = (clock: Clock = systemClock): WeekBoard => {
  const { client, household } = useSession()
  const { weekStart } = useSelectedWeek(clock)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['week', household?.id, weekStart],
    enabled: household !== undefined,
    queryFn: async () => {
      const result = await loadWeek(client, weekStart)
      if (isErr(result)) {
        // A Week Plan that does not exist yet is an expected outcome, not an
        // error: nobody has planned this week. Render an empty board.
        if (result.error === 'no-week-plan') {
          return { weekPlanId: undefined, cookEvents: [], leftovers: [], backlog: [] }
        }
        // Anything else is a failure, and failures throw: Query then keeps the
        // last good board instead of replacing it with an empty one.
        throw new Error(`Could not load the week: ${result.error}`)
      }

      const backlog = await loadBacklog(client, result.value.weekPlanId)
      if (isErr(backlog)) throw new Error(`Could not load the Backlog: ${backlog.error}`)
      return { ...result.value, backlog: backlog.value }
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
    weekPlanId: data?.weekPlanId,
    weekStart,
    householdName: household?.name ?? '',
    isLoading: isLoading || household === undefined,
    isError,
    hasData: data !== undefined,
    refetch: () => {
      void refetch()
    },
  }
}
