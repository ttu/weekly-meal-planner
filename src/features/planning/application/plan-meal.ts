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
): Promise<Result<CookEventId | undefined, PlanMealError>> => {
  const { data: rpcData, error } = await client.rpc('plan_meal', {
    ...(input.backlogItemId === undefined ? {} : { p_backlog_item_id: input.backlogItemId }),
    p_week_plan_id: input.weekPlanId,
    p_meal_id: input.mealId,
    p_date: input.date,
    p_slot_key: input.slotKey,
    p_servings_cooked: input.servingsCooked,
    p_added_by: input.addedBy,
  })

  if (error !== null) return err('write-failed')

  // Generated types say `string` (Postgres types cannot express a nullable return), and
  // lint rejects both `as string | null` and a narrower annotation, so check at runtime.
  const data: unknown = rpcData

  // null is deliberate: the Backlog Item is already gone (another Member planned
  // it, or this is a retry after success), so the Meal is planned. Not a failure.
  if (data === null) return ok(undefined)
  if (typeof data === 'string') return ok(brand<string, 'CookEventId'>(data))
  return err('write-failed')
}
