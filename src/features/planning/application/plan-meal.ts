import { ok, err, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { AppSupabaseClient, SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import type { BacklogItemId, CookEventId } from '../domain/types'

export type PlanMealError = 'write-failed'

type Input = {
  readonly backlogItemId?: BacklogItemId
  readonly weekPlanId: string
  readonly mealId: MealId
  readonly date: string
  readonly slotKey: SlotKey
  readonly servingsCooked: Servings
  readonly addedBy: string
}

/**
 * Creating the Cook Event and removing the Backlog Item must not half-happen,
 * so both go through one RPC. `backlogItemId` is optional: planning straight
 * onto the board without going via the Backlog is a valid path.
 */
export const planMeal = async (
  client: AppSupabaseClient,
  input: Input,
): Promise<Result<CookEventId, PlanMealError>> => {
  const { data, error } = await client.rpc('plan_meal', {
    ...(input.backlogItemId === undefined ? {} : { p_backlog_item_id: input.backlogItemId }),
    p_week_plan_id: input.weekPlanId,
    p_meal_id: input.mealId,
    p_date: input.date,
    p_slot_key: input.slotKey,
    p_servings_cooked: input.servingsCooked,
    p_added_by: input.addedBy,
  })

  if (error !== null || typeof data !== 'string') return err('write-failed')

  return ok(brand<string, 'CookEventId'>(data))
}
