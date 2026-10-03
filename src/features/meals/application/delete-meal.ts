import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import { isStoredPhoto } from '../domain/photo'
import { deleteMealPhoto } from '../infrastructure/meal-photo-repository'
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
  // Read the photo's path first: once the row is gone there is nothing left to
  // say which object belonged to it, and Storage has no cascade.
  const { data } = await client.from('meal').select('photo_url').eq('id', id).maybeSingle()
  const path = data?.photo_url ?? undefined

  const { error } = await client.from('meal').delete().eq('id', id)
  if (error !== null) return err('write-failed')

  // A leftover file is invisible; failing the delete over one would not be.
  if (path !== undefined && isStoredPhoto(path)) await deleteMealPhoto(client, path)

  return ok(undefined)
}
