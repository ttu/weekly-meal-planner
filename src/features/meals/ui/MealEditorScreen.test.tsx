import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { MealEditorScreen } from './MealEditorScreen'
import { fireEvent } from '@testing-library/react-native'
import type { IngredientId, Quantity, Servings } from '../domain/types'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const show = async (over: Partial<Parameters<typeof MealEditorScreen>[0]> = {}) =>
  renderWithProviders(
    <MealEditorScreen
      defaultServings={3 as Servings}
      ingredients={[]}
      isPending={false}
      onSave={jest.fn()}
      onCancel={jest.fn()}
      {...over}
    />,
  )

describe('MealEditorScreen servings', () => {
  it('starts a new Meal at the default it is given', async () => {
    const view = await show()
    expect(view.getByTestId('editor-servings').props.children).toBe('3')
  })

  it('keeps an existing Meal at its own servings', async () => {
    const view = await show({
      initial: { name: 'Chili', servings: 6 as Servings, ingredients: [] },
    })
    expect(view.getByTestId('editor-servings').props.children).toBe('6')
  })
})

describe('MealEditorScreen with an Ingredient this build does not know', () => {
  // Another Member's newer build can name a slug this one has never heard of.
  // Hidden, it was still saved, and the save failed with no visible cause.
  const initial = {
    name: 'Paella',
    servings: 4 as Servings,
    ingredients: [
      { ingredientId: 'saffron' as IngredientId, quantity: 1 as Quantity, unit: 'pinch' },
    ],
  }

  it('shows the row by its slug and says why it cannot be saved', async () => {
    const view = await show({ initial })
    expect(view.getByText('saffron')).toBeTruthy()
    expect(view.getByTestId('ingredient-unknown-saffron')).toBeTruthy()
  })

  it('can be removed, and then the Meal saves without it', async () => {
    const onSave = jest.fn()
    const view = await show({ initial, onSave })
    await fireEvent.press(view.getByTestId('ingredient-remove-saffron'))
    await fireEvent.press(view.getByTestId('editor-save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ ingredients: [] }))
  })
})
