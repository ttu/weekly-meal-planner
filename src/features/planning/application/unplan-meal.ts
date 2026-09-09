import { ok, err, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { AppSupabaseClient } from '@/features/household'
import type { BacklogItemId, CookEventId } from '../domain/types'

export type UnplanMealError = 'write-failed'

/**
 * Removes the Cook Event and restores the Backlog Item in one operation, so the
 * Meal can never fall out of the week entirely. Leftovers cascade (ADR 0004).
 */
export const unplanMeal = async (
  client: AppSupabaseClient,
  cookEventId: CookEventId,
): Promise<Result<BacklogItemId | undefined, UnplanMealError>> => {
  const { data, error } = await client.rpc('unplan_meal', { p_cook_event_id: cookEventId })

  if (error !== null) return err('write-failed')

  return ok(typeof data === 'string' ? brand<string, 'BacklogItemId'>(data) : undefined)
}
