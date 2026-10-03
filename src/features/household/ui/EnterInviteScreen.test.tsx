// fireEvent is async in react-native-testing-library v14, like render.
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { EnterInviteScreen } from './EnterInviteScreen'

const TOKEN = 'u7Qx-3Zk_pL9aB2cD4eF6gH8iJ0kL2mN4oP6qR8sT0u'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

describe('EnterInviteScreen', () => {
  it('opens the board a pasted link points at', async () => {
    const onOpen = jest.fn()
    const view = await renderWithProviders(<EnterInviteScreen onOpen={onOpen} onBack={jest.fn()} />)

    await fireEvent.changeText(
      view.getByTestId('invite-link'),
      `https://meals.example/join/${TOKEN}`,
    )
    await fireEvent.press(view.getByTestId('invite-open'))

    expect(onOpen).toHaveBeenCalledWith(TOKEN)
  })

  it('says so when the paste holds no invite, and opens nothing', async () => {
    const onOpen = jest.fn()
    const view = await renderWithProviders(<EnterInviteScreen onOpen={onOpen} onBack={jest.fn()} />)

    await fireEvent.changeText(view.getByTestId('invite-link'), 'ask dad')
    await fireEvent.press(view.getByTestId('invite-open'))

    expect(view.getByTestId('invite-error')).toBeTruthy()
    expect(onOpen).not.toHaveBeenCalled()
  })

  // The complaint is about what was typed, so it goes when that changes.
  it('clears the complaint as soon as the field is edited', async () => {
    const view = await renderWithProviders(
      <EnterInviteScreen onOpen={jest.fn()} onBack={jest.fn()} />,
    )

    await fireEvent.changeText(view.getByTestId('invite-link'), 'ask dad')
    await fireEvent.press(view.getByTestId('invite-open'))
    await fireEvent.changeText(view.getByTestId('invite-link'), TOKEN)

    expect(view.queryByTestId('invite-error')).toBeNull()
  })
})
