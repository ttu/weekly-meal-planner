import { render } from '@testing-library/react-native'
import { initI18n, setLocale } from '@/shared/i18n'
import { LeftoverCard } from './LeftoverCard'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

describe('LeftoverCard', () => {
  it('names its parent Meal', async () => {
    const view = await render(<LeftoverCard parentMealName="Chili con carne" />)
    expect(view.getByText('Chili con carne — leftovers')).toBeTruthy()
  })

  // A Leftover borrows its Servings from its Cook Event and must never read as
  // a Meal in its own right (ADR 0004).
  it('never shows a servings line', async () => {
    const view = await render(<LeftoverCard parentMealName="Chili con carne" />)
    expect(view.queryByTestId('meal-card-servings-cooked')).toBeNull()
  })

  it('translates the suffix into Finnish', async () => {
    await setLocale('fi')
    const view = await render(<LeftoverCard parentMealName="Chili con carne" />)
    expect(view.getByText('Chili con carne — tähteet')).toBeTruthy()
    await view.unmount()
    await setLocale('en')
  })
})
