import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isErr, type Result } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession, type SlotKey } from '@/features/household'
import { addLeftover } from '../application/add-leftover'
import { moveCookEvent } from '../application/move-cook-event'
import { moveLeftover } from '../application/move-leftover'
import { removeLeftover } from '../application/remove-leftover'
import { unplanMeal } from '../application/unplan-meal'
import { setServingsCooked } from '../application/set-servings-cooked'
import { removeBacklogItem } from '../application/remove-backlog-item'
import type { Servings } from '@/features/meals'
import type { BacklogItemId, CookEventId, LeftoverId } from '../domain/types'
import { useSelectedWeek } from './SelectedWeek'
import { IDEMPOTENT_WRITE_RETRY } from '@/shared/net/queryClient'

export type LeftoverRequest = {
  readonly cookEventId: CookEventId
  readonly date: string
  readonly slotKey: SlotKey
}

export type MoveRequest = {
  readonly cookEventId: CookEventId
  readonly date: string
  readonly slotKey: SlotKey
}

export type MoveLeftoverRequest = {
  readonly leftoverId: LeftoverId
  readonly date: string
  readonly slotKey: SlotKey
}

export type PlanningActions = {
  readonly addLeftoverFor: (request: LeftoverRequest) => void
  readonly move: (request: MoveRequest) => void
  readonly moveLeftoverTo: (request: MoveLeftoverRequest) => void
  readonly removeLeftoverCard: (id: LeftoverId) => void
  readonly unplan: (cookEventId: CookEventId) => void
  readonly setServings: (cookEventId: CookEventId, servingsCooked: Servings) => void
  readonly removeFromBacklog: (id: BacklogItemId) => void
  readonly leftoverFailed: boolean
  readonly moveFailed: boolean
  readonly unplanFailed: boolean
}

/**
 * The three destructive-or-additive board actions share one invalidation key,
 * so they live together rather than in three near-identical hooks.
 */
export const usePlanningActions = (clock: Clock = systemClock): PlanningActions => {
  const { client, household } = useSession()
  const queryClient = useQueryClient()
  const { weekStart } = useSelectedWeek(clock)

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['week', household?.id, weekStart] })
  }

  /**
   * One write: run the use case, throw its error so Query counts the failure,
   * refresh the week either way. `idempotent` opts into retries: only for
   * writes where repeating leaves the same state (see IDEMPOTENT_WRITE_RETRY).
   */
  const useWrite = <V>(
    run: (variables: V) => Promise<Result<unknown, string>>,
    idempotent = true,
  ) =>
    useMutation({
      retry: idempotent ? IDEMPOTENT_WRITE_RETRY : false,
      mutationFn: async (variables: V) => {
        const result = await run(variables)
        if (isErr(result)) throw new Error(result.error)
      },
      onSettled: invalidate,
    })

  // An insert is not idempotent: a retry after a lost response would add a second Leftover.
  const leftoverMutation = useWrite((r: LeftoverRequest) => addLeftover(client, r), false)
  const moveMutation = useWrite((r: MoveRequest) => moveCookEvent(client, r))
  const moveLeftoverMutation = useWrite((r: MoveLeftoverRequest) => moveLeftover(client, r))
  const removeLeftoverMutation = useWrite((id: LeftoverId) => removeLeftover(client, id))
  const unplanMutation = useWrite((id: CookEventId) => unplanMeal(client, id))
  const servingsMutation = useWrite(({ id, servings }: { id: CookEventId; servings: Servings }) =>
    setServingsCooked(client, id, servings),
  )
  const removeMutation = useWrite((id: BacklogItemId) => removeBacklogItem(client, id))

  return {
    addLeftoverFor: (request) => {
      leftoverMutation.mutate(request)
    },
    move: (request) => {
      moveMutation.mutate(request)
    },
    moveLeftoverTo: (request) => {
      moveLeftoverMutation.mutate(request)
    },
    removeLeftoverCard: (id) => {
      removeLeftoverMutation.mutate(id)
    },
    unplan: (cookEventId) => {
      unplanMutation.mutate(cookEventId)
    },
    setServings: (cookEventId, servingsCooked) => {
      servingsMutation.mutate({ id: cookEventId, servings: servingsCooked })
    },
    removeFromBacklog: (id) => {
      removeMutation.mutate(id)
    },
    leftoverFailed:
      leftoverMutation.isError || moveLeftoverMutation.isError || removeLeftoverMutation.isError,
    moveFailed: moveMutation.isError,
    unplanFailed: unplanMutation.isError,
  }
}
