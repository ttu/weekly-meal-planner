import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { clearFocusCalls, focusedTestIDs } from '@/test/focus'
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

describe('SignInScreen keyboard flow', () => {
  beforeEach(clearFocusCalls)

  it('Next on the email field moves to the password field', async () => {
    const view = await renderWithProviders(<SignInScreen client={client} />)
    await fireEvent(view.getByTestId('sign-in-email'), 'submitEditing')
    expect(focusedTestIDs()).toEqual(['sign-in-password'])
  })

  // Go on the keyboard and then the button (or Go twice) must not start two
  // sign-ins: the second would race the first and could show a stale error.
  it('starts one sign-in however many times it is submitted while pending', async () => {
    const signInWithPassword = jest.fn(() => new Promise<never>(() => undefined))
    const pendingClient = { auth: { signInWithPassword } } as never
    const view = await renderWithProviders(<SignInScreen client={pendingClient} />)

    const password = view.getByTestId('sign-in-password')
    await fireEvent(password, 'submitEditing')
    await fireEvent(password, 'submitEditing')
    await fireEvent.press(view.getByTestId('sign-in-submit'))

    expect(signInWithPassword).toHaveBeenCalledTimes(1)
  })

  it('can sign in again once the first attempt has failed', async () => {
    const signInWithPassword = jest.fn(() => Promise.resolve({ error: { status: 400 } }))
    const view = await renderWithProviders(
      <SignInScreen client={{ auth: { signInWithPassword } } as never} />,
    )
    const password = view.getByTestId('sign-in-password')
    await fireEvent(password, 'submitEditing')
    await view.findByTestId('sign-in-error')
    await fireEvent(password, 'submitEditing')

    expect(signInWithPassword).toHaveBeenCalledTimes(2)
  })

  it('keeps the form scrollable and taps working with the keyboard up', async () => {
    const view = await renderWithProviders(<SignInScreen client={client} />)
    expect(view.getByTestId('sign-in-screen').props.keyboardShouldPersistTaps).toBe('handled')
  })
})
