import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { EnterInviteScreen } from './EnterInviteScreen'
import { JoinBoardScreen } from './JoinBoardScreen'
import { SignInScreen } from './SignInScreen'
import { StartBoardScreen } from './StartBoardScreen'

// None of these screens reaches the client before a submit.
const client = {} as never

/**
 * Every way into the app is someone's first sight of it — often from a link
 * in a family chat — so each one says what it is before asking for anything.
 */
const entryScreens: readonly (readonly [string, () => React.JSX.Element])[] = [
  [
    'starting a board',
    () => <StartBoardScreen isPending={false} onCreate={jest.fn()} onSignInInstead={jest.fn()} />,
  ],
  ['signing in', () => <SignInScreen client={client} />],
  ['entering an invite', () => <EnterInviteScreen onOpen={jest.fn()} onBack={jest.fn()} />],
  ['joining a board', () => <JoinBoardScreen isPending={false} onJoin={jest.fn()} />],
  [
    'joining a named board',
    () => (
      <JoinBoardScreen
        isPending={false}
        onJoin={jest.fn()}
        preview={{ name: 'Koivisto', members: [{ name: 'Aino', colour: '#B5532E' }] }}
      />
    ),
  ],
]

describe.each(['en', 'fi'] as const)('the way in, in %s', (locale) => {
  beforeAll(async () => {
    initI18n(locale)
    await setLocale(locale)
  })

  it.each(entryScreens)('names the app when %s', async (_, screen) => {
    const view = await renderWithProviders(screen())
    expect(view.getByTestId('wordmark')).toHaveTextContent('Menami')
  })
})
