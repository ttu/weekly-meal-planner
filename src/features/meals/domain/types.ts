import type {
  HouseholdId,
  IngredientId,
  IngredientSlug,
  MealId,
  Quantity,
  Servings,
} from '@/shared/types/ids'
import type { Dimension } from '@/shared/units'

export type {
  HouseholdId,
  IngredientId,
  IngredientSlug,
  MealId,
  Quantity,
  Servings,
} from '@/shared/types/ids'
export type { Dimension } from '@/shared/units'

export type Meal = {
  readonly id: MealId
  readonly householdId?: HouseholdId
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

export type MealDetail = Meal & {
  readonly ingredients: readonly {
    readonly ingredientId: IngredientId
    readonly quantity: Quantity
    readonly unit: string
  }[]
}

export const isCatalogueMeal = (meal: Meal): boolean => meal.householdId === undefined
