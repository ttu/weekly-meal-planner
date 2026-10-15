import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n } from '@/shared/i18n'
import { JoinBoardScreen } from './JoinBoardScreen'
import { StartBoardScreen } from './StartBoardScreen'

beforeAll(async () => {
  initI18n('en')
  await Promise.resolve()
})

/**
 * While the beta key is set, starting and joining a board both ask for it.
 * When it is not, neither screen grows a field nobody needs.
 */
describe('the beta key on the way in', () => {
  describe('starting a board', () => {
    it('does not ask when no key is required', async () => {
      const view = await renderWithProviders(
        <StartBoardScreen isPending={false} onCreate={jest.fn()} onSignInInstead={jest.fn()} />,
      )
      expect(view.queryByTestId('start-beta-key')).toBeNull()
    })

    it('sends the key it was given', async () => {
      const onCreate = jest.fn()
      const view = await renderWithProviders(
        <StartBoardScreen
          isPending={false}
          askBetaKey
          onCreate={onCreate}
          onSignInInstead={jest.fn()}
        />,
      )
      await fireEvent.changeText(view.getByTestId('start-beta-key'), 'kokeilu-avain')
      await fireEvent.press(view.getByTestId('start-create'))
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ betaKey: 'kokeilu-avain' }))
    })

    it('says when the key was wrong', async () => {
      const view = await renderWithProviders(
        <StartBoardScreen
          isPending={false}
          askBetaKey
          error="invalid-beta-key"
          onCreate={jest.fn()}
          onSignInInstead={jest.fn()}
        />,
      )
      expect(view.getByTestId('start-error')).toHaveTextContent(
        'That beta key is not right. Ask whoever invited you to the beta.',
      )
    })
  })

  describe('joining a board', () => {
    it('does not ask when no key is required', async () => {
      const view = await renderWithProviders(
        <JoinBoardScreen isPending={false} onJoin={jest.fn()} />,
      )
      expect(view.queryByTestId('join-beta-key')).toBeNull()
    })

    it('sends the key it was given', async () => {
      const onJoin = jest.fn()
      const view = await renderWithProviders(
        <JoinBoardScreen isPending={false} askBetaKey onJoin={onJoin} />,
      )
      await fireEvent.changeText(view.getByTestId('join-beta-key'), 'kokeilu-avain')
      await fireEvent.press(view.getByTestId('join-submit'))
      expect(onJoin).toHaveBeenCalledWith(expect.objectContaining({ betaKey: 'kokeilu-avain' }))
    })

    // Not the "check with Dad or Mum" line: the board password may well have
    // been right, and sending someone to ask about it again is a wild goose
    // chase.
    it('says the key was wrong, not the password', async () => {
      const view = await renderWithProviders(
        <JoinBoardScreen
          isPending={false}
          askBetaKey
          error="invalid-beta-key"
          preview={{ name: 'Koivisto', members: [{ name: 'Aino', colour: '#5F7355' }] }}
          onJoin={jest.fn()}
        />,
      )
      expect(view.getByTestId('join-error')).toHaveTextContent(
        'That beta key is not right. Ask whoever invited you to the beta.',
      )
    })
  })
})
