import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { MealLibraryScreen } from './MealLibraryScreen'
import type { HouseholdId, Meal, MealId, Servings } from '../domain/types'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const own = (id: string, name: string, ingredientCount: number): Meal => ({
  id: id as MealId,
  householdId: 'h1' as HouseholdId,
  name,
  servings: 4 as Servings,
  ingredientCount,
})

const catalogue = (id: string, name: string): Meal => ({
  id: id as MealId,
  name,
  servings: 2 as Servings,
  ingredientCount: 3,
})

const meals = [
  own('1', 'Munavoileivät', 0),
  own('2', 'Chili con carne', 5),
  catalogue('3', 'Shakshuka'),
]

describe('MealLibraryScreen', () => {
  it('lists Household Meals and Catalogue Meals under their headings', async () => {
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} />)
    expect(view.getByText('Ours')).toBeTruthy()
    expect(view.getByText('Catalogue')).toBeTruthy()
    expect(view.getByText('Shakshuka')).toBeTruthy()
  })

  // "Tacos · no Ingredients yet" is the signal a Member needs before planning it.
  it('says when a Meal has no Ingredients yet', async () => {
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} />)
    expect(view.getByText('No Ingredients yet')).toBeTruthy()
  })

  it('counts Ingredients when there are some', async () => {
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} />)
    expect(view.getByText('5 Ingredients')).toBeTruthy()
  })

  it('filters by search, ignoring diacritics', async () => {
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} />)
    await fireEvent.changeText(view.getByTestId('library-search'), 'munavoileivat')
    expect(view.getByText('Munavoileivät')).toBeTruthy()
    expect(view.queryByText('Shakshuka')).toBeNull()
  })

  it('reports the chosen Meal', async () => {
    const onSelect = jest.fn()
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} onSelect={onSelect} />)
    await fireEvent.press(view.getByTestId('library-meal-2'))
    expect(onSelect).toHaveBeenCalledWith('2')
  })

  it('offers to add a Meal', async () => {
    const onAdd = jest.fn()
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} onAdd={onAdd} />)
    await fireEvent.press(view.getByTestId('library-add'))
    expect(onAdd).toHaveBeenCalled()
  })

  it('names the next action when the library is empty', async () => {
    const view = await renderWithProviders(<MealLibraryScreen meals={[]} />)
    expect(view.getByText('No Meals yet. Add the first one.')).toBeTruthy()
  })
})
