import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession, type SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import { planMeal } from '../application/plan-meal'
import { resolveWeekPlanId } from '../application/resolve-week-plan'
import type { BacklogItemId } from '../domain/types'
import { useSelectedWeek } from './SelectedWeek'

export type PlanRequest = {
  /** Omitted for a week nobody has planned into yet; it is made on the spot. */
  readonly weekPlanId?: string | undefined
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
  const { weekStart } = useSelectedWeek(clock)

  const mutation = useMutation({
    mutationFn: async (request: PlanRequest) => {
      if (userId === undefined) throw new Error('not-signed-in')
      if (household === undefined) throw new Error('no-household')

      // The week ahead has no Week Plan until someone plans into it, and
      // being planned into is exactly what is happening here.
      const weekPlanId =
        request.weekPlanId ?? (await resolveWeekPlanId(client, household.id, weekStart))
      if (weekPlanId === undefined) throw new Error('no-week-plan')

      const result = await planMeal(client, { ...request, weekPlanId, addedBy: userId })
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
