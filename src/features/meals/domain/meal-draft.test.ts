import { validateMealDraft } from './meal-draft'
import { isOk, isErr } from '@/shared/types/result'
import type { IngredientId, Quantity, Servings } from './types'

const draft = (name: string, ingredients: { id: string }[] = []) => ({
  name,
  servings: 4 as Servings,
  ingredients: ingredients.map((i) => ({
    ingredientId: i.id as IngredientId,
    quantity: 1 as Quantity,
    unit: 'g',
    optional: false,
  })),
})

describe('validateMealDraft', () => {
  it('accepts a named Meal', () => {
    expect(isOk(validateMealDraft(draft('Tacos')))).toBe(true)
  })

  // The day-one path creates a Meal from a name alone.
  it('accepts a Meal with no Ingredients', () => {
    const result = validateMealDraft(draft('Tacos'))
    if (isOk(result)) expect(result.value.ingredients).toHaveLength(0)
  })

  it('trims the name', () => {
    const result = validateMealDraft(draft('  Tacos  '))
    if (isOk(result)) expect(result.value.name).toBe('Tacos')
  })

  it('rejects an empty name', () => {
    expect(isErr(validateMealDraft(draft('   ')))).toBe(true)
  })

  it('rejects a name over the column limit', () => {
    expect(isErr(validateMealDraft(draft('x'.repeat(121))))).toBe(true)
  })

  // meal_ingredient is keyed on (meal_id, ingredient_id); a duplicate would
  // fail at the database with an opaque error instead of an explainable one.
  it('rejects the same Ingredient twice', () => {
    expect(isErr(validateMealDraft(draft('Tacos', [{ id: 'a' }, { id: 'a' }])))).toBe(true)
  })
})
