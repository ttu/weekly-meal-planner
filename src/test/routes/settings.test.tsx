import { fireEvent, waitFor } from '@testing-library/react-native'
import { initI18n, setLocale } from '@/shared/i18n'
import Settings from '@/app/settings'
import { renderWithProviders } from '../render'
import { breakableKv, testBoard } from '../test-board'

// The router is a third-party SDK; nothing here navigates.
jest.mock('expo-router', () => ({ Redirect: () => null, router: { back: jest.fn() } }))

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

describe('the settings route', () => {
  it('says a role change could not be saved when it throws, and logs why', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const storage = breakableKv()
    const board = await testBoard('en', { storage: storage.kv })
    const invited = await board.engine.invite('member')
    if (invited.kind !== 'ok') throw new Error('no invite')
    const view = await renderWithProviders(
      <board.wrapper>
        <Settings />
      </board.wrapper>,
    )
    const [roleButton] = await view.findAllByTestId(/^member-role-/)
    if (!roleButton) throw new Error('no other Member')
    storage.broken.now = true
    await fireEvent.press(roleButton)
    await waitFor(() => {
      expect(view.getByTestId('settings-error')).toHaveTextContent(/Could not save/)
    })
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('settings.admin-failed'))
    logged.mockRestore()
  })
})
