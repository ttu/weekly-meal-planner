import { fireEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { createInviteLink } from '@/features/household'
import { SyncProvider } from '@/features/sync'
import { initI18n, setLocale } from '@/shared/i18n'
import { isOk } from '@/shared/types/result'
import Join from '@/app/join'
import { renderWithProviders } from '../render'
import { breakableKv, testBoard, type TestBoard } from '../test-board'

// The router is a third-party SDK: only where it was sent is checked.
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }))

const replace = jest.mocked(router.replace)

const inviteTo = async (board: TestBoard): Promise<string> => {
  const link = await createInviteLink(board.engine, 'https://menami.app')
  if (!isOk(link)) throw new Error('no invite')
  return link.value
}

type View = Awaited<ReturnType<typeof renderWithProviders>>

const join = async (view: View, link: string): Promise<void> => {
  await fireEvent.changeText(view.getByTestId('join-link'), link)
  await fireEvent.changeText(view.getByTestId('join-your-name'), 'Bob')
  await fireEvent.press(view.getByTestId('join-submit'))
}

/** The route on a device with no board open, over the same relay as `board`. */
const onFreshDevice = async (board: TestBoard): Promise<View> => {
  const view = await renderWithProviders(
    <SyncProvider deps={board.deps}>
      <Join />
    </SyncProvider>,
  )
  await waitFor(() => {
    expect(view.getByTestId('join-submit')).toBeTruthy()
  })
  return view
}

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

beforeEach(() => {
  replace.mockClear()
})

describe('the join route', () => {
  it('asks before replacing the board that is open, and keeps it on cancel', async () => {
    const board = await testBoard()
    const link = await inviteTo(board)
    const view = await renderWithProviders(
      <board.wrapper>
        <Join />
      </board.wrapper>,
    )
    await join(view, link)
    expect(view.getByTestId('confirm-detail')).toHaveTextContent(/recovery link/)
    await fireEvent.press(view.getByTestId('confirm-no'))
    expect(view.queryByTestId('confirm-sheet')).toBeNull()
    expect(replace).not.toHaveBeenCalled()

    await fireEvent.press(view.getByTestId('join-submit'))
    await fireEvent.press(view.getByTestId('confirm-yes'))
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/')
    })
  })

  it('joins at once when no board is open', async () => {
    const board = await testBoard()
    const link = await inviteTo(board)
    const view = await onFreshDevice(board)
    await join(view, link)
    expect(view.queryByTestId('confirm-sheet')).toBeNull()
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/')
    })
  })

  it('says the board was joined but not saved when this device cannot keep it, and logs why', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const vault = breakableKv((key) => key === 'sync/current-seat')
    const board = await testBoard('en', { vault: vault.kv })
    const link = await inviteTo(board)
    vault.broken.now = true
    const view = await onFreshDevice(board)
    await join(view, link)
    await waitFor(() => {
      expect(view.getByTestId('join-error')).toHaveTextContent(/could not save/)
    })
    expect(replace).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('join.not-saved'))
    logged.mockRestore()
  })
})
