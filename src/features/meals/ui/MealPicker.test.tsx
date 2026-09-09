// fireEvent is async in react-native-testing-library v14, like render. An
// un-awaited call leaves the component un-rerendered and the assertion reads
// the old tree.
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { MealPicker } from './MealPicker'
import type { HouseholdRef, Meal, MealId, Servings } from '../domain/types'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const own = (id: string, name: string): Meal => ({
  id: id as MealId,
  householdId: 'h1' as HouseholdRef,
  name,
  servings: 4 as Servings,
})

const catalogue = (id: string, name: string): Meal => ({
  id: id as MealId,
  name,
  servings: 2 as Servings,
})

const meals = [own('1', 'Munavoileivät'), own('2', 'Tacos'), catalogue('3', 'Shakshuka')]

describe('MealPicker', () => {
  it('lists Household Meals and Catalogue Meals under their own headings', async () => {
    const view = await renderWithProviders(
      <MealPicker visible meals={meals} onSelect={jest.fn()} onDismiss={jest.fn()} />,
    )
    expect(view.getByText('Ours')).toBeTruthy()
    expect(view.getByText('Catalogue')).toBeTruthy()
    expect(view.getByText('Shakshuka')).toBeTruthy()
  })

  // Adding a Catalogue Meal copies it (ADR 0005); the picker says so rather
  // than surprising the family later.
  it('tells you a Catalogue Meal will be copied', async () => {
    const view = await renderWithProviders(
      <MealPicker visible meals={meals} onSelect={jest.fn()} onDismiss={jest.fn()} />,
    )
    expect(view.getByText('Copy to your library to edit')).toBeTruthy()
  })

  it('filters by search, ignoring diacritics', async () => {
    const view = await renderWithProviders(
      <MealPicker visible meals={meals} onSelect={jest.fn()} onDismiss={jest.fn()} />,
    )
    await fireEvent.changeText(view.getByTestId('picker-search'), 'munavoileivat')
    expect(view.getByText('Munavoileivät')).toBeTruthy()
    expect(view.queryByText('Tacos')).toBeNull()
  })

  it('shows a written empty state when nothing matches', async () => {
    const view = await renderWithProviders(
      <MealPicker visible meals={meals} onSelect={jest.fn()} onDismiss={jest.fn()} />,
    )
    await fireEvent.changeText(view.getByTestId('picker-search'), 'zzzz')
    expect(view.getByTestId('picker-no-results')).toBeTruthy()
  })

  it('reports the chosen Meal', async () => {
    const onSelect = jest.fn()
    const view = await renderWithProviders(
      <MealPicker visible meals={meals} onSelect={onSelect} onDismiss={jest.fn()} />,
    )
    await fireEvent.press(view.getByTestId('picker-meal-2'))
    expect(onSelect).toHaveBeenCalledWith('2')
  })

  it('can be dismissed', async () => {
    const onDismiss = jest.fn()
    const view = await renderWithProviders(
      <MealPicker visible meals={meals} onSelect={jest.fn()} onDismiss={onDismiss} />,
    )
    await fireEvent.press(view.getByTestId('picker-cancel'))
    expect(onDismiss).toHaveBeenCalled()
  })
})
