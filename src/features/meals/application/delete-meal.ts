import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { MealId } from '../domain/types'

export type DeleteMealError = 'write-failed'

/**
 * `meal_id` cascades from cook_event and backlog_item, so deleting a Meal
 * removes it from planned weeks — and its Leftovers with it. That is a real
 * consequence and the caller must have said so before getting here.
 */
export const deleteMeal = async (
  client: AppSupabaseClient,
  id: MealId,
): Promise<Result<void, DeleteMealError>> => {
  const { error } = await client.from('meal').delete().eq('id', id)
  if (error !== null) return err('write-failed')
  return ok(undefined)
}
