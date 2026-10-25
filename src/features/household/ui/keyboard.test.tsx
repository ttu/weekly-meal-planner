import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { clearFocusCalls, focusedTestIDs } from '@/test/focus'
import { initI18n, setLocale } from '@/shared/i18n'
import { JoinBoardScreen } from './JoinBoardScreen'
import { StartBoardScreen } from './StartBoardScreen'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

beforeEach(clearFocusCalls)

// Next on the keyboard must land in the next field, not just be labelled
// "next". Jest cannot show a real keyboard, but it can show which field was
// asked to take focus when the keyboard's submit key is pressed.
describe('Next walks the start form', () => {
  const start = (askBetaKey: boolean): React.JSX.Element => (
    <StartBoardScreen
      isPending={false}
      askBetaKey={askBetaKey}
      onCreate={jest.fn()}
      onSignInInstead={jest.fn()}
    />
  )

  it('board name, then your name, then the password', async () => {
    const view = await renderWithProviders(start(false))
    await fireEvent(view.getByTestId('start-board-name'), 'submitEditing')
    await fireEvent(view.getByTestId('start-your-name'), 'submitEditing')
    expect(focusedTestIDs()).toEqual(['start-your-name', 'start-password'])
  })

  it('the password is the last field, so it says Done', async () => {
    const view = await renderWithProviders(start(false))
    expect(view.getByTestId('start-password').props.returnKeyType).toBe('done')
  })

  it('the password goes on to the beta key when one is asked for', async () => {
    const view = await renderWithProviders(start(true))
    const password = view.getByTestId('start-password')
    expect(password.props.returnKeyType).toBe('next')
    await fireEvent(password, 'submitEditing')
    expect(focusedTestIDs()).toEqual(['start-beta-key'])
  })
})

describe('Next walks the join form', () => {
  const join = (askBetaKey: boolean): React.JSX.Element => (
    <JoinBoardScreen isPending={false} askBetaKey={askBetaKey} onJoin={jest.fn()} />
  )

  it('your name, then the password', async () => {
    const view = await renderWithProviders(join(false))
    await fireEvent(view.getByTestId('join-your-name'), 'submitEditing')
    expect(focusedTestIDs()).toEqual(['join-password'])
    expect(view.getByTestId('join-password').props.returnKeyType).toBe('done')
  })

  it('the password goes on to the beta key when one is asked for', async () => {
    const view = await renderWithProviders(join(true))
    await fireEvent(view.getByTestId('join-password'), 'submitEditing')
    expect(focusedTestIDs()).toEqual(['join-beta-key'])
  })
})
