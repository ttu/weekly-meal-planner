import type { Brand } from '@/shared/types/brand'

export type HouseholdRef = Brand<string, 'HouseholdId'>
export type MealId = Brand<string, 'MealId'>
export type IngredientId = Brand<string, 'IngredientId'>
export type IngredientSlug = Brand<string, 'IngredientSlug'>

/**
 * Servings and Quantity are branded for the same reason ids are:
 * `scale(quantity, servings)` taking two bare numbers is the bug that puts four
 * kilos of onions on a Shopping List.
 */
export type Servings = Brand<number, 'Servings'>
export type Quantity = Brand<number, 'Quantity'>

/** Mass, volume or count. Quantities convert only within one, which is what
 *  makes the Shopping List's aggregation honest. Declared here rather than in
 *  units.ts so the two modules do not form a cycle. */
export type Dimension = 'mass' | 'volume' | 'count'

export type Meal = {
  readonly id: MealId
  readonly householdId?: HouseholdRef
  readonly name: string
  readonly servings: Servings
  readonly photoUrl?: string
  /** How many Ingredients it has. "Tacos · no Ingredients yet" is the signal a
   *  Member needs before planning it. */
  readonly ingredientCount: number
}

/**
 * Identity is the slug, never the name (ADR 0009). `name` here is already
 * resolved for the Household's Locale by the repository.
 */
export type Ingredient = {
  readonly id: IngredientId
  readonly slug: IngredientSlug
  readonly name: string
  readonly category: string
  readonly dimension: Dimension
  readonly baseUnit: string
}

export const isCatalogueMeal = (meal: Meal): boolean => meal.householdId === undefined
