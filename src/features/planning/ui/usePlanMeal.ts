import { useBoardSession, type SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import { useData, useSync } from '@/features/sync'
import { planMeal } from '../application/planning-data'
import type { BacklogItemId } from '../domain/types'
import { useWrite } from '@/shared/query/useWrite'

export type PlanRequest = {
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

/** The week comes from the date planned, so this needs no clock. */
export const usePlanMeal = (): PlanMeal => {
  const { userId } = useBoardSession()
  const data = useData()
  const { deps } = useSync()
  const write = useWrite()

  return {
    plan: (request) => {
      if (!data || userId === undefined) return
      write.run(() => planMeal(data, deps.random, { ...request, addedBy: userId }))
    },
    isPending: write.pending,
    hasFailed: write.failed,
  }
}
