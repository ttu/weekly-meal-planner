import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { IngredientPicker } from './IngredientPicker'
import { IngredientRow } from './IngredientRow'
import { MealPicker } from './MealPicker'
import type { Ingredient, IngredientId, IngredientSlug } from '../domain/types'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const beef: Ingredient = {
  id: 'i1' as IngredientId,
  slug: 'minced-beef' as IngredientSlug,
  name: 'minced beef',
  category: 'meat',
  dimension: 'mass',
  baseUnit: 'g',
}

// Prop checks only: Jest has no keyboard, so these pin the configuration, not
// the behaviour. That a tap gets through while the keyboard is up is checked on
// a device. Without 'handled', the first tap on a result would only dismiss the
// keyboard — the search field sits above the list it filters.
describe('keyboard props on the pickers', () => {
  it('MealPicker lets a tap on a result through while the keyboard is up', async () => {
    const view = await renderWithProviders(
      <MealPicker visible meals={[]} onSelect={jest.fn()} onDismiss={jest.fn()} />,
    )
    expect(view.getByTestId('picker-results').props.keyboardShouldPersistTaps).toBe('handled')
  })

  it('IngredientPicker lets a tap on a result through while the keyboard is up', async () => {
    const view = await renderWithProviders(
      <IngredientPicker visible ingredients={[]} onSelect={jest.fn()} onDismiss={jest.fn()} />,
    )
    expect(view.getByTestId('ingredient-results').props.keyboardShouldPersistTaps).toBe('handled')
  })

  it('the picker search fields offer search, not a newline', async () => {
    const view = await renderWithProviders(
      <IngredientPicker visible ingredients={[]} onSelect={jest.fn()} onDismiss={jest.fn()} />,
    )
    expect(view.getByTestId('ingredient-search').props.returnKeyType).toBe('search')
  })

  it('the quantity field is dismissed with Done', async () => {
    const view = await renderWithProviders(
      <IngredientRow
        ingredient={beef}
        quantityText="400"
        unit="g"
        isQuantityValid
        onQuantityChange={jest.fn()}
        onUnitChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    )
    expect(view.getByTestId('ingredient-quantity-minced-beef').props.returnKeyType).toBe('done')
  })
})
