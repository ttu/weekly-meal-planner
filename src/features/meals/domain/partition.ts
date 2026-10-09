import type { Locale } from '@/shared/i18n'
import { matchesSearch } from './search'
import { isCatalogueMeal, type Meal } from './types'

export type PartitionedMeals = {
  readonly ours: readonly Meal[]
  readonly catalogue: readonly Meal[]
}

/**
 * Sorted by the Household's own Locale, not the runtime's: in Finnish ä and ö
 * come after z, and a default sort files "Äyriäiskeitto" under A — at the top
 * of a list where a Finn would look for it at the bottom.
 */
const byName =
  (locale: Locale) =>
  (a: Meal, b: Meal): number =>
    a.name.localeCompare(b.name, locale)

/**
 * Own Meals first: a family reaches for what they already cook far more often
 * than for the Catalogue. Shared by the library screen and the picker, which
 * are two views of the same list and must not drift apart.
 *
 * Both halves are alphabetical. They used to arrive in whatever order the rows
 * came back in — for the Catalogue, the order of the seed file — which is no
 * order at all to someone looking for one Meal among thirty on a phone.
 */
export const partitionMeals = (
  meals: readonly Meal[],
  query: string,
  locale: Locale,
): PartitionedMeals => {
  const matching = meals.filter((meal) => matchesSearch(meal.name, query))
  const alphabetically = byName(locale)
  return {
    ours: matching.filter((meal) => !isCatalogueMeal(meal)).sort(alphabetically),
    catalogue: matching.filter(isCatalogueMeal).sort(alphabetically),
  }
}
