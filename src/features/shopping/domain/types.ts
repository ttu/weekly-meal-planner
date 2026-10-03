import type { Brand } from '@/shared/types/brand'
import type { IngredientId, MealId, Quantity, Servings } from '@/shared/types/ids'
import type { Dimension } from '@/shared/units'

export type ExtraId = Brand<string, 'ExtraId'>

/** A Cook Event reduced to what the derivation needs. Leftovers are absent by
 *  construction: they contribute nothing (ADR 0004). */
export type PlannedMeal = {
  readonly mealId: MealId
  readonly mealName: string
  readonly mealServings: Servings
  readonly servingsCooked: Servings
}

export type MealIngredient = {
  readonly mealId: MealId
  readonly ingredientId: IngredientId
  readonly quantity: Quantity
  readonly unit: string
}

export type IngredientInfo = {
  readonly id: IngredientId
  readonly name: string
  readonly category: string
  readonly dimension: Dimension
  readonly baseUnit: string
}

export type Staple = {
  readonly ingredientId: IngredientId
  readonly runningLow: boolean
}

export type Override = {
  readonly ingredientId: IngredientId
  readonly quantity: Quantity
  readonly unit: string
  readonly reason?: string
}

export type Extra = {
  readonly id: ExtraId
  readonly label: string
  readonly checked: boolean
}

/** One Meal's contribution to a Buy Line — what "why four onions?" expands to. */
export type Contribution = {
  readonly mealName: string
  readonly quantity: Quantity
  readonly unit: string
}

export type Amount = {
  readonly quantity: Quantity
  readonly unit: string
}

export type BuyLine = {
  readonly ingredientId: IngredientId
  readonly name: string
  readonly category: string
  /** Usually one. More than one when a Meal measured an Ingredient in a unit
   *  from another dimension: those stay separate rather than being guessed at. */
  readonly amounts: readonly Amount[]
  readonly contributions: readonly Contribution[]
  readonly isOverridden: boolean
  readonly overrideReason?: string
  readonly promotedFromCupboard: boolean
  readonly checked: boolean
}

export type CupboardLine = {
  readonly ingredientId: IngredientId
  readonly name: string
  readonly category: string
}

/** A planned Meal nobody has given Ingredients yet. Surfaced rather than
 *  silently omitted, so the gap is visible before the shop, not at the stove. */
export type IncompleteMealLine = {
  readonly mealId: MealId
  readonly mealName: string
}

export type ShoppingList = {
  /**
   * How many sittings this list is for — Cook Events, not distinct Meals.
   * Chili on Monday and again on Thursday is two, and the header has to agree
   * with the board above it, which shows two cards.
   */
  readonly sittings: number
  readonly buy: readonly BuyLine[]
  readonly cupboard: readonly CupboardLine[]
  readonly extras: readonly Extra[]
  readonly incomplete: readonly IncompleteMealLine[]
}
