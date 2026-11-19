import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { JoinBoardScreen } from './JoinBoardScreen'
import { StartBoardScreen } from './StartBoardScreen'

/**
 * Every way into the app is someone's first sight of it — often from a link
 * in a family chat — so each one says what it is before asking for anything.
 */
const entryScreens: readonly (readonly [string, () => React.JSX.Element])[] = [
  ['starting a board', () => <StartBoardScreen isPending={false} onCreate={jest.fn()} />],
  ['joining a board', () => <JoinBoardScreen isPending={false} onJoin={jest.fn()} />],
  [
    'joining from an opened link',
    () => <JoinBoardScreen isPending={false} onJoin={jest.fn()} initialLink={'a'.repeat(256)} />,
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
