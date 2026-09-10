import { ok, err, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { AppSupabaseClient, HouseholdId } from '@/features/household'
import type { MealId } from '../domain/types'

export type CopyCatalogueMealError = 'write-failed'

/**
 * Adding a Catalogue Meal copies it (ADR 0005). The family's copy is theirs to
 * edit, and a Catalogue edit never changes a planned week.
 */
export const copyCatalogueMeal = async (
  client: AppSupabaseClient,
  householdId: HouseholdId,
  sourceMealId: MealId,
): Promise<Result<MealId, CopyCatalogueMealError>> => {
  const { data, error } = await client.rpc('copy_catalogue_meal', {
    p_household_id: householdId,
    p_source_meal_id: sourceMealId,
  })

  if (error !== null || typeof data !== 'string') return err('write-failed')

  return ok(brand<string, 'MealId'>(data))
}
