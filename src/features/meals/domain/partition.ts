import { matchesSearch } from './search'
import { isCatalogueMeal, type Meal } from './types'

export type PartitionedMeals = {
  readonly ours: readonly Meal[]
  readonly catalogue: readonly Meal[]
}

/**
 * Own Meals first: a family reaches for what they already cook far more often
 * than for the Catalogue. Shared by the library screen and the picker, which
 * are two views of the same list and must not drift apart.
 */
export const partitionMeals = (meals: readonly Meal[], query: string): PartitionedMeals => {
  const matching = meals.filter((meal) => matchesSearch(meal.name, query))
  return {
    ours: matching.filter((meal) => !isCatalogueMeal(meal)),
    catalogue: matching.filter(isCatalogueMeal),
  }
}
