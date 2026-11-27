import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import type { IngredientId, MealId, Quantity } from '@/shared/types/ids'
import type { ExtraId, ShoppingList } from '../domain/types'
import { ShoppingListScreen } from './ShoppingListScreen'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const empty: ShoppingList = { sittings: 0, buy: [], cupboard: [], extras: [], incomplete: [] }
const withCoffee: ShoppingList = {
  ...empty,
  extras: [{ id: 'e1' as ExtraId, label: 'Coffee', checked: false }],
}

const noop = (): void => undefined

const screen = (props: Partial<React.ComponentProps<typeof ShoppingListScreen>> = {}) => (
  <ShoppingListScreen
    list={empty}
    onToggle={noop}
    onOutOf={noop}
    onAddExtra={noop}
    onToggleExtra={noop}
    onCopyPrompt={noop}
    justCopied={false}
    {...props}
  />
)

describe('ShoppingListScreen load states', () => {
  it('says there is nothing to buy only once the list has loaded', async () => {
    const view = await renderWithProviders(screen({ loadState: 'ready' }))
    expect(view.getByTestId('shopping-empty')).toBeTruthy()
  })

  it('never shows the empty state while loading', async () => {
    const view = await renderWithProviders(screen({ loadState: 'loading' }))
    expect(view.queryByTestId('shopping-empty')).toBeNull()
    expect(view.getByTestId('loading')).toBeTruthy()
  })

  it('draws no retry button when there is nothing to retry with', async () => {
    const view = await renderWithProviders(screen({ loadState: 'failed' }))
    expect(view.getByTestId('load-error')).toBeTruthy()
    expect(view.queryByTestId('load-error-retry')).toBeNull()
  })

  it('shows an error with a retry, not an empty list, when the first load failed', async () => {
    const onRetry = jest.fn()
    const view = await renderWithProviders(screen({ loadState: 'failed', onRetry }))
    expect(view.queryByTestId('shopping-empty')).toBeNull()
    expect(view.getByText('Could not load this. Check your connection and try again.')).toBeTruthy()

    await fireEvent.press(view.getByTestId('load-error-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('cannot copy a prompt for a list that is not there', async () => {
    const onCopyPrompt = jest.fn()
    const view = await renderWithProviders(screen({ loadState: 'failed', onCopyPrompt }))
    expect(view.queryByTestId('copy-prompt')).toBeNull()
  })

  it('keeps the list and adds a notice with a retry when a refresh failed', async () => {
    const onRetry = jest.fn()
    const view = await renderWithProviders(
      screen({ list: withCoffee, loadState: 'stale', onRetry }),
    )
    expect(view.getByText('Coffee')).toBeTruthy()
    expect(view.getByText('Could not refresh. Showing what was loaded before.')).toBeTruthy()

    await fireEvent.press(view.getByTestId('load-stale-action'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows no notice when everything loaded', async () => {
    const view = await renderWithProviders(screen({ list: withCoffee, loadState: 'ready' }))
    expect(view.queryByTestId('load-stale')).toBeNull()
  })
})

describe('ShoppingListScreen with only Extras', () => {
  // An Extras-only list said "Nothing to buy yet" and would not copy.
  it('is not empty, counts the Extras, and copies a prompt', async () => {
    const onCopyPrompt = jest.fn()
    const view = await renderWithProviders(
      screen({ list: withCoffee, loadState: 'ready', onCopyPrompt }),
    )
    expect(view.queryByTestId('shopping-empty')).toBeNull()
    expect(view.getByText(/1 still to buy/)).toBeTruthy()
    await fireEvent.press(view.getByTestId('copy-prompt'))
    expect(onCopyPrompt).toHaveBeenCalledTimes(1)
  })
})

describe('ShoppingListScreen amounts', () => {
  const line = (quantity: number, unit: string): ShoppingList['buy'][number] => ({
    ingredientId: 'flour' as IngredientId,
    name: 'flour',
    category: 'dry-goods',
    amounts: [{ quantity: quantity as Quantity, unit }],
    contributions: [],
    isOverridden: false,
    promotedFromCupboard: false,
    checked: false,
  })

  // A unit from another Member's newer build has no translation here.
  it('shows an unknown unit as itself, not as a translation key', async () => {
    const view = await renderWithProviders(
      screen({ list: { ...empty, buy: [line(2, 'tbsp')] }, loadState: 'ready' }),
    )
    expect(view.getByText('2 tbsp')).toBeTruthy()
    expect(view.queryByText(/unit\.tbsp/)).toBeNull()
  })

  it('writes decimals the way the Locale does', async () => {
    await setLocale('fi')
    const view = await renderWithProviders(
      screen({ list: { ...empty, buy: [line(1.5, 'kg')] }, loadState: 'ready' }),
    )
    expect(view.getByText('1,5 kg')).toBeTruthy()
    await view.unmount()
    await setLocale('en')
  })
})

describe('ShoppingListScreen with an unknown Ingredient', () => {
  it('says the Meal names an Ingredient this version does not know', async () => {
    const view = await renderWithProviders(
      screen({
        list: {
          ...empty,
          incomplete: [
            { mealId: 'paella' as MealId, mealName: 'Paella', reason: 'unknown-ingredient' },
          ],
        },
        loadState: 'ready',
      }),
    )
    expect(view.getByText(/Paella — has an Ingredient/)).toBeTruthy()
  })
})
