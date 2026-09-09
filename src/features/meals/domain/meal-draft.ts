import { ok, err, type Result } from '@/shared/types/result'
import type { IngredientId, Quantity, Servings } from './types'

export type MealIngredientDraft = {
  readonly ingredientId: IngredientId
  readonly quantity: Quantity
  readonly unit: string
  readonly optional: boolean
}

export type MealDraft = {
  readonly name: string
  readonly servings: Servings
  readonly ingredients: readonly MealIngredientDraft[]
}

export type MealDraftError = 'name-required' | 'name-too-long' | 'duplicate-ingredient'

/**
 * An empty name is an expected outcome of a form, not an exception, so this
 * returns a Result the editor can render.
 *
 * An empty Ingredient list is deliberately valid: the day-one path creates a
 * Meal from a name alone.
 */
export const validateMealDraft = (draft: MealDraft): Result<MealDraft, MealDraftError> => {
  const name = draft.name.trim()
  if (name.length === 0) return err('name-required')
  if (name.length > 120) return err('name-too-long')

  const ids = draft.ingredients.map((i) => i.ingredientId)
  if (new Set(ids).size !== ids.length) return err('duplicate-ingredient')

  return ok({ ...draft, name })
}
