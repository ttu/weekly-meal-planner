import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession, type SlotKey } from '@/features/household'
import { currentWeekStart } from '../domain/week'
import { addLeftover } from '../application/add-leftover'
import { unplanMeal } from '../application/unplan-meal'
import { removeBacklogItem } from '../application/remove-backlog-item'
import type { BacklogItemId, CookEventId } from '../domain/types'

export type LeftoverRequest = {
  readonly cookEventId: CookEventId
  readonly date: string
  readonly slotKey: SlotKey
}

export type PlanningActions = {
  readonly addLeftoverFor: (request: LeftoverRequest) => void
  readonly unplan: (cookEventId: CookEventId) => void
  readonly removeFromBacklog: (id: BacklogItemId) => void
  readonly leftoverFailed: boolean
  readonly unplanFailed: boolean
}

/**
 * The three destructive-or-additive board actions share one invalidation key,
 * so they live together rather than in three near-identical hooks.
 */
export const usePlanningActions = (clock: Clock = systemClock): PlanningActions => {
  const { client, household } = useSession()
  const queryClient = useQueryClient()
  const weekStart = currentWeekStart(clock)

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['week', household?.id, weekStart] })
  }

  const leftoverMutation = useMutation({
    mutationFn: async (request: LeftoverRequest) => {
      const result = await addLeftover(client, request)
      if (isErr(result)) throw new Error(result.error)
      return result.value
    },
    onSettled: invalidate,
  })

  const unplanMutation = useMutation({
    mutationFn: async (cookEventId: CookEventId) => {
      const result = await unplanMeal(client, cookEventId)
      if (isErr(result)) throw new Error(result.error)
      return result.value
    },
    onSettled: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: async (id: BacklogItemId) => {
      const result = await removeBacklogItem(client, id)
      if (isErr(result)) throw new Error(result.error)
    },
    onSettled: invalidate,
  })

  return {
    addLeftoverFor: (request) => {
      leftoverMutation.mutate(request)
    },
    unplan: (cookEventId) => {
      unplanMutation.mutate(cookEventId)
    },
    removeFromBacklog: (id) => {
      removeMutation.mutate(id)
    },
    leftoverFailed: leftoverMutation.isError,
    unplanFailed: unplanMutation.isError,
  }
}
