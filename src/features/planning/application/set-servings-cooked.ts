import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { Servings } from '@/features/meals'
import type { CookEventId } from '../domain/types'

export type SetServingsCookedError = 'write-failed'

/**
 * How many this Cook Event is being cooked for.
 *
 * Changing it is the thing a week actually needs most often — two more at the
 * table on Thursday — and until now the only way was to unplan the Meal and
 * plan it again. Servings Cooked scales every Ingredient on the Shopping List,
 * so this is the amount bought, not a label on a card.
 */
export const setServingsCooked = async (
  client: AppSupabaseClient,
  cookEventId: CookEventId,
  servingsCooked: Servings,
): Promise<Result<CookEventId, SetServingsCookedError>> => {
  const { error } = await client
    .from('cook_event')
    .update({ servings_cooked: servingsCooked })
    .eq('id', cookEventId)

  if (error !== null) return err('write-failed')

  return ok(cookEventId)
}
