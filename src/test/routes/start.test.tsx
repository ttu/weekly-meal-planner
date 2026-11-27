import { fireEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { SyncProvider } from '@/features/sync'
import { initI18n, setLocale } from '@/shared/i18n'
import Start from '@/app/start'
import { renderWithProviders } from '../render'
import { breakableKv, testBoard } from '../test-board'

// The router is a third-party SDK: only where it was sent is checked.
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }))

const replace = jest.mocked(router.replace)

const create = async (view: Awaited<ReturnType<typeof renderWithProviders>>): Promise<void> => {
  await fireEvent.changeText(view.getByTestId('start-board-name'), 'Cabin')
  await fireEvent.changeText(view.getByTestId('start-your-name'), 'Alice')
  await fireEvent.press(view.getByTestId('start-create'))
}

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

beforeEach(() => {
  replace.mockClear()
})

describe('the start route', () => {
  it('asks before replacing the board that is open, and keeps it on cancel', async () => {
    const board = await testBoard()
    const view = await renderWithProviders(
      <board.wrapper>
        <Start />
      </board.wrapper>,
    )
    await create(view)
    expect(view.getByTestId('confirm-detail')).toHaveTextContent(/recovery link/)
    await fireEvent.press(view.getByTestId('confirm-no'))
    expect(view.queryByTestId('confirm-sheet')).toBeNull()
    expect(replace).not.toHaveBeenCalled()

    await fireEvent.press(view.getByTestId('start-create'))
    await fireEvent.press(view.getByTestId('confirm-yes'))
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/')
    })
  })

  it('says the board was made but not saved when this device cannot keep it, and logs why', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const vault = breakableKv((key) => key === 'sync/current-seat')
    const board = await testBoard('en', { vault: vault.kv })
    vault.broken.now = true
    const view = await renderWithProviders(
      <SyncProvider deps={board.deps}>
        <Start />
      </SyncProvider>,
    )
    await waitFor(() => {
      expect(view.getByTestId('start-create')).toBeTruthy()
    })
    await create(view)
    await waitFor(() => {
      expect(view.getByTestId('start-error')).toHaveTextContent(/could not save/)
    })
    expect(replace).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('start.not-saved'))
    logged.mockRestore()
  })
})
