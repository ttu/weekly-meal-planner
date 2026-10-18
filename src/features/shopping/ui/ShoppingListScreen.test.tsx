import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { NetworkSourceProvider } from '@/shared/net/NetworkSourceContext'
import type { NetworkSource } from '@/shared/net/networkSource'
import { initI18n, setLocale } from '@/shared/i18n'
import type { ExtraId } from '../domain/types'
import type { ShoppingList } from '../domain/types'
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

// The device's network is a system boundary; the screen reads it via useIsOnline.
const online: NetworkSource = {
  read: () => Promise.resolve(true),
  subscribe: () => () => undefined,
}

const noop = (): void => undefined

const screen = (props: Partial<React.ComponentProps<typeof ShoppingListScreen>> = {}) => (
  <NetworkSourceProvider source={online}>
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
  </NetworkSourceProvider>
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
