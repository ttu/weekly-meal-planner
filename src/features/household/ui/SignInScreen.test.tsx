import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n } from '@/shared/i18n'
import { DEMO_ACCOUNTS } from '../domain/demo-accounts'
import { SignInScreen } from './SignInScreen'

beforeAll(async () => {
  initI18n('en')
  await Promise.resolve()
})

// The screen only ever talks to the client on submit, which these tests do
// not reach; a bare object keeps expo and supabase out of the render.
const client = {} as never

describe('SignInScreen', () => {
  /**
   * The list is a development convenience. The screen decides nothing about
   * which build it is in — the route hands the accounts in under `__DEV__`,
   * so a production build simply has none to give.
   */
  it('offers no seeded logins when none are handed to it', async () => {
    const view = await renderWithProviders(<SignInScreen client={client} />)
    expect(view.queryByTestId('demo-logins')).toBeNull()
  })

  it('lists the seeded logins it is given', async () => {
    const view = await renderWithProviders(
      <SignInScreen client={client} demoAccounts={DEMO_ACCOUNTS} />,
    )
    expect(view.getByTestId('demo-logins')).toBeTruthy()
    expect(view.getByText('aino@example.test')).toBeTruthy()
  })

  // The whole point: two taps to a signed-in board instead of typing an
  // address and a password nobody remembers.
  it('fills both fields from the one that was tapped', async () => {
    const view = await renderWithProviders(
      <SignInScreen client={client} demoAccounts={DEMO_ACCOUNTS} />,
    )
    await fireEvent.press(view.getByTestId('demo-login-sanni'))

    const sanni = DEMO_ACCOUNTS.find((account) => account.displayName === 'Sanni')
    expect(view.getByTestId('sign-in-email').props.value).toBe(sanni?.email)
    expect(view.getByTestId('sign-in-password').props.value).toBe(sanni?.password)
  })

  it('says who owns the board', async () => {
    const view = await renderWithProviders(
      <SignInScreen client={client} demoAccounts={DEMO_ACCOUNTS} />,
    )
    expect(view.getByText('Aino · owner')).toBeTruthy()
  })

  // On a phone there is no browser chrome to go back with, and signing in is
  // a detour from starting a board.
  it('offers the way back when the route gives it one', async () => {
    const onBack = jest.fn()
    const view = await renderWithProviders(<SignInScreen client={client} onBack={onBack} />)
    await fireEvent.press(view.getByText('← Back to the start'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
