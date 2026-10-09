import { partitionMeals } from './partition'
import type { Meal } from './types'
import type { HouseholdId, MealId, Servings } from '@/shared/types/ids'

const meal = (name: string, mine: boolean): Meal => ({
  id: name as MealId,
  ...(mine ? { householdId: 'h1' as HouseholdId } : {}),
  name,
  servings: 4 as Servings,
  ingredientCount: 3,
})

const catalogueInFileOrder = [
  meal('Tacos', false),
  meal('Chili con carne', false),
  meal('Omelette', false),
  meal('Äyriäiskeitto', false),
]

describe('partitionMeals', () => {
  it('keeps the household’s own Meals apart from the Catalogue', () => {
    const { ours, catalogue } = partitionMeals(
      [meal('Mummon lohikeitto', true), meal('Pizza', false)],
      '',
      'fi',
    )
    expect(ours.map((m) => m.name)).toEqual(['Mummon lohikeitto'])
    expect(catalogue.map((m) => m.name)).toEqual(['Pizza'])
  })

  /**
   * The Catalogue used to arrive in the order the seed file happened to list
   * it, which is no order at all to a person looking for "Pizza" in a list of
   * thirty on a phone.
   */
  it('puts the Catalogue in alphabetical order', () => {
    const { catalogue } = partitionMeals(catalogueInFileOrder, '', 'fi')
    expect(catalogue.map((m) => m.name)).toEqual([
      'Chili con carne',
      'Omelette',
      'Tacos',
      'Äyriäiskeitto',
    ])
  })

  // Finnish sorts ä after z, which a code-unit sort gets wrong in the other
  // direction — and these are Finnish Meal names.
  it('sorts the household’s own Meals too, by the Locale’s rules', () => {
    const { ours } = partitionMeals(
      [meal('Öljykala', true), meal('Ahven', true), meal('Äyriäiset', true)],
      '',
      'fi',
    )
    expect(ours.map((m) => m.name)).toEqual(['Ahven', 'Äyriäiset', 'Öljykala'])
  })

  it('still filters by the search query', () => {
    const { catalogue } = partitionMeals(catalogueInFileOrder, 'tac', 'fi')
    expect(catalogue.map((m) => m.name)).toEqual(['Tacos'])
  })
})
