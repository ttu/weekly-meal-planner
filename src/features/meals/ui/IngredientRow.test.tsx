import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { IngredientRow } from './IngredientRow'
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

const props = {
  ingredient: beef,
  quantityText: '400',
  unit: 'g',
  isQuantityValid: true,
  onQuantityChange: jest.fn(),
  onUnitChange: jest.fn(),
  onRemove: jest.fn(),
}

describe('IngredientRow', () => {
  it('shows the Ingredient name and amount', async () => {
    const view = await renderWithProviders(<IngredientRow {...props} />)
    expect(view.getByText('minced beef')).toBeTruthy()
    expect(view.getByTestId('ingredient-quantity-minced-beef').props.value).toBe('400')
  })

  // Offering litres of minced beef would let a Member create a Meal the
  // Shopping List cannot aggregate.
  it('offers only units from the Ingredient dimension', async () => {
    const view = await renderWithProviders(<IngredientRow {...props} />)
    expect(view.getByTestId('ingredient-unit-minced-beef-g')).toBeTruthy()
    expect(view.getByTestId('ingredient-unit-minced-beef-kg')).toBeTruthy()
    expect(view.queryByTestId('ingredient-unit-minced-beef-l')).toBeNull()
    expect(view.queryByTestId('ingredient-unit-minced-beef-pcs')).toBeNull()
  })

  it('reports a changed amount', async () => {
    const onQuantityChange = jest.fn()
    const view = await renderWithProviders(
      <IngredientRow {...props} onQuantityChange={onQuantityChange} />,
    )
    await fireEvent.changeText(view.getByTestId('ingredient-quantity-minced-beef'), '0,5')
    expect(onQuantityChange).toHaveBeenCalledWith('0,5')
  })

  it('reports a changed unit', async () => {
    const onUnitChange = jest.fn()
    const view = await renderWithProviders(<IngredientRow {...props} onUnitChange={onUnitChange} />)
    await fireEvent.press(view.getByTestId('ingredient-unit-minced-beef-kg'))
    expect(onUnitChange).toHaveBeenCalledWith('kg')
  })

  it('reports removal', async () => {
    const onRemove = jest.fn()
    const view = await renderWithProviders(<IngredientRow {...props} onRemove={onRemove} />)
    await fireEvent.press(view.getByTestId('ingredient-remove-minced-beef'))
    expect(onRemove).toHaveBeenCalled()
  })

  it('shows an error when the amount is not usable', async () => {
    const view = await renderWithProviders(<IngredientRow {...props} isQuantityValid={false} />)
    expect(view.getByTestId('ingredient-error-minced-beef')).toBeTruthy()
  })
})
