import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession, type SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import { currentWeekStart } from '../domain/week'
import { planMeal } from '../application/plan-meal'
import type { BacklogItemId } from '../domain/types'

export type PlanRequest = {
  readonly weekPlanId: string
  readonly mealId: MealId
  readonly backlogItemId?: BacklogItemId
  readonly date: string
  readonly slotKey: SlotKey
  readonly servingsCooked: Servings
}

export type PlanMeal = {
  readonly plan: (request: PlanRequest) => void
  readonly isPending: boolean
  readonly hasFailed: boolean
}

export const usePlanMeal = (clock: Clock = systemClock): PlanMeal => {
  const { client, household, userId } = useSession()
  const queryClient = useQueryClient()
  const weekStart = currentWeekStart(clock)

  const mutation = useMutation({
    mutationFn: async (request: PlanRequest) => {
      if (userId === undefined) throw new Error('not-signed-in')

      const result = await planMeal(client, { ...request, addedBy: userId })
      if (isErr(result)) throw new Error(result.error)
      return result.value
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['week', household?.id, weekStart] })
    },
  })

  return {
    plan: (request) => {
      mutation.mutate(request)
    },
    isPending: mutation.isPending,
    hasFailed: mutation.isError,
  }
}
