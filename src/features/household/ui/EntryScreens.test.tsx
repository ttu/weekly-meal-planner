import { fireEvent } from '@testing-library/react-native'
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

describe('starting a board', () => {
  beforeAll(async () => {
    initI18n('en')
    await setLocale('en')
  })

  it('cannot be sent until both names are given', async () => {
    const onCreate = jest.fn()
    const view = await renderWithProviders(
      <StartBoardScreen isPending={false} onCreate={onCreate} />,
    )
    await fireEvent.changeText(view.getByTestId('start-board-name'), 'Home')
    await fireEvent.changeText(view.getByTestId('start-your-name'), '   ')
    await fireEvent.press(view.getByTestId('start-create'))
    expect(onCreate).not.toHaveBeenCalled()
    await fireEvent.changeText(view.getByTestId('start-your-name'), 'Alice')
    await fireEvent.press(view.getByTestId('start-create'))
    expect(onCreate).toHaveBeenCalledWith({ boardName: 'Home', displayName: 'Alice' })
  })
})
