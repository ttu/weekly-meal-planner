import { ok, err, isErr, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { AppSupabaseClient, HouseholdId } from '@/features/household'
import { validateMealDraft, type MealDraft, type MealDraftError } from '../domain/meal-draft'
import type { MealId } from '../domain/types'

export type SaveMealError = MealDraftError | 'write-failed'

type Input = MealDraft & {
  readonly id?: MealId
  readonly householdId: HouseholdId
}

export const saveMeal = async (
  client: AppSupabaseClient,
  input: Input,
): Promise<Result<MealId, SaveMealError>> => {
  const validated = validateMealDraft(input)
  if (isErr(validated)) return err(validated.error)

  const { data, error } = await client.rpc('save_meal', {
    p_household_id: input.householdId,
    p_name: validated.value.name,
    p_servings: validated.value.servings,
    // Sent as a plain JSON array: the generated Json type does not accept a
    // readonly tuple of branded values.
    p_ingredients: validated.value.ingredients.map((i) => ({
      ingredientId: String(i.ingredientId),
      quantity: Number(i.quantity),
      unit: i.unit,
      optional: i.optional,
    })),
    ...(input.id === undefined ? {} : { p_meal_id: input.id }),
  })

  if (error !== null || typeof data !== 'string') return err('write-failed')

  return ok(brand<string, 'MealId'>(data))
}
