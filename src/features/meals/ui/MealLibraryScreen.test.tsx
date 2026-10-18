import { StyleSheet, View } from 'react-native'
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
    expect(view.getByText('Ours · 2')).toBeTruthy()
    expect(view.getAllByText('Catalogue').length).toBeGreaterThan(0)
    expect(view.getByText('Shakshuka')).toBeTruthy()
  })

  // Servings, not an Ingredient count: the library row answers "will this feed
  // us tonight", which is the question being asked while choosing.
  it('says how many a Meal serves', async () => {
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} />)
    expect(view.getAllByText('Serves 4')).toHaveLength(2)
    expect(view.getByText('Serves 2')).toBeTruthy()
  })

  // A Catalogue Meal is marked as one: it cannot be edited until it is copied,
  // and finding that out after opening the editor is too late.
  it('marks a Catalogue Meal as one', async () => {
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} />)
    expect(view.getAllByText('Catalogue')).toHaveLength(2)
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

  it('virtualises a long list instead of mounting every row', async () => {
    const many = Array.from({ length: 400 }, (_, i) => own(`m${String(i)}`, `Meal ${String(i)}`, 1))
    const view = await renderWithProviders(<MealLibraryScreen meals={many} />)
    expect(view.getByTestId('library-meal-m0')).toBeTruthy()
    expect(view.queryByTestId('library-meal-m399')).toBeNull()
  })

  // SectionList wraps each item/header/footer in its own View, so a container
  // gap doubles; spacing must sit on the rows instead.
  it('spaces rows without a container gap', async () => {
    const view = await renderWithProviders(<MealLibraryScreen meals={meals} layout="pane" />)
    const list = view.getByTestId('library-list')
    expect(StyleSheet.flatten(list.props.contentContainerStyle)).not.toHaveProperty('gap')
    let node = view.getByTestId('library-meal-1').parent
    const paddingTop = (n: typeof node): unknown =>
      (StyleSheet.flatten(n?.props.style) as { paddingTop?: unknown } | undefined)?.paddingTop
    while (node !== null && paddingTop(node) !== 7) node = node.parent
    expect(node).not.toBeNull()
  })

  it('lets the board wrap each row, for dragging', async () => {
    const wrapRow = jest.fn((meal: Meal, row: React.ReactNode) => (
      <View testID={`drag-${meal.id}`}>{row}</View>
    ))
    const view = await renderWithProviders(
      <MealLibraryScreen meals={meals} layout="pane" wrapRow={wrapRow} />,
    )
    expect(wrapRow).toHaveBeenCalledTimes(3)
    expect(view.getByTestId('drag-1')).toBeTruthy()
  })
})
