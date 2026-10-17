import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { MealEditorScreen } from './MealEditorScreen'
import type { Servings } from '../domain/types'

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
