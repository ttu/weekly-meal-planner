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

export type Meal = {
  readonly id: MealId
  readonly householdId?: HouseholdRef
  readonly name: string
  readonly servings: Servings
  readonly photoUrl?: string
}

export const isCatalogueMeal = (meal: Meal): boolean => meal.householdId === undefined
