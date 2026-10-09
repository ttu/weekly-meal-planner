import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
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

  const leftoverMutation = useMutation({
    mutationFn: async (request: LeftoverRequest) => {
      const result = await addLeftover(client, request)
      if (isErr(result)) throw new Error(result.error)
      return result.value
    },
    onSettled: invalidate,
  })

  const moveMutation = useMutation({
    mutationFn: async (request: MoveRequest) => {
      const result = await moveCookEvent(client, request)
      if (isErr(result)) throw new Error(result.error)
      return result.value
    },
    onSettled: invalidate,
  })

  const moveLeftoverMutation = useMutation({
    mutationFn: async (request: MoveLeftoverRequest) => {
      const result = await moveLeftover(client, request)
      if (isErr(result)) throw new Error(result.error)
      return result.value
    },
    onSettled: invalidate,
  })

  const removeLeftoverMutation = useMutation({
    mutationFn: async (id: LeftoverId) => {
      const result = await removeLeftover(client, id)
      if (isErr(result)) throw new Error(result.error)
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

  const servingsMutation = useMutation({
    mutationFn: async ({ id, servings }: { id: CookEventId; servings: Servings }) => {
      const result = await setServingsCooked(client, id, servings)
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
