// fireEvent is async in react-native-testing-library v14, like render.
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { brand } from '@/shared/types/brand'
import { SettingsScreen } from './SettingsScreen'
import { SLOT_PRESETS } from '../domain/slot-edit'
import type { Slot } from '../domain/types'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const preset = (name: string): Slot => {
  const found = SLOT_PRESETS.find((s) => s.key === brand<string, 'SlotKey'>(name))
  if (found === undefined) throw new Error(`No preset ${name}`)
  return found
}

const DEFAULTS = [preset('lunch'), preset('dinner')]

const ANONYMOUS = { isPending: false, onAddEmail: jest.fn() }

const show = async (over: Partial<Parameters<typeof SettingsScreen>[0]> = {}) =>
  renderWithProviders(
    <SettingsScreen
      account={ANONYMOUS}
      locale="en"
      onChangeLocale={jest.fn()}
      size={brand<number, 'HouseholdSize'>(4)}
      onChangeSize={jest.fn()}
      slots={DEFAULTS}
      isPending={false}
      onAddPreset={jest.fn()}
      onAddNamed={jest.fn()}
      onRemove={jest.fn()}
      onMove={jest.fn()}
      onBack={jest.fn()}
      {...over}
    />,
  )

describe('SettingsScreen', () => {
  it('shows how many the household cooks for', async () => {
    const view = await show({ size: brand<number, 'HouseholdSize'>(3) })
    expect(view.getByTestId('settings-size-value').props.children).toBe('3')
  })

  it('asks for one more or one fewer', async () => {
    const onChangeSize = jest.fn()
    const view = await show({ size: brand<number, 'HouseholdSize'>(3), onChangeSize })

    await fireEvent.press(view.getByTestId('settings-size-less'))
    expect(onChangeSize).toHaveBeenLastCalledWith(2)
    await fireEvent.press(view.getByTestId('settings-size-more'))
    expect(onChangeSize).toHaveBeenLastCalledWith(4)
  })

  it('cannot go below one', async () => {
    const onChangeSize = jest.fn()
    const view = await show({ size: brand<number, 'HouseholdSize'>(1), onChangeSize })

    await fireEvent.press(view.getByTestId('settings-size-less'))
    expect(onChangeSize).not.toHaveBeenCalled()
  })

  it('lists the Slots in the order the day runs', async () => {
    const view = await show()
    expect(view.getByText('Lunch')).toBeTruthy()
    expect(view.getByText('Dinner')).toBeTruthy()
  })

  it('offers only the presets the board does not already have', async () => {
    const view = await show()
    expect(view.getByTestId('settings-add-breakfast')).toBeTruthy()
    expect(view.queryByTestId('settings-add-lunch')).toBeNull()
  })

  it('cannot move the first Slot earlier or the last one later', async () => {
    const onMove = jest.fn()
    const view = await show({ onMove })

    await fireEvent.press(view.getByTestId('settings-up-lunch'))
    await fireEvent.press(view.getByTestId('settings-down-dinner'))

    expect(onMove).not.toHaveBeenCalled()
  })

  it('moves a Slot down the day', async () => {
    const onMove = jest.fn()
    const view = await show({ onMove })

    await fireEvent.press(view.getByTestId('settings-down-lunch'))

    expect(onMove).toHaveBeenCalledWith('lunch', 1)
  })

  it('adds a Slot the household named, and clears the field', async () => {
    const onAddNamed = jest.fn()
    const view = await show({ onAddNamed })

    await fireEvent.changeText(view.getByTestId('settings-own-name'), 'Eväät')
    await fireEvent.press(view.getByTestId('settings-add-own'))

    expect(onAddNamed).toHaveBeenCalledWith('Eväät')
    expect(view.getByTestId('settings-own-name').props.value).toBe('')
  })

  it('shows a Slot the household named under their own word, not a key', async () => {
    const view = await show({
      slots: [
        ...DEFAULTS,
        { key: brand<string, 'SlotKey'>('ev-t'), labelKey: 'ev-t', label: 'Eväät' },
      ],
    })
    expect(view.getByText('Eväät')).toBeTruthy()
  })

  // The last Slot cannot go; the screen says why rather than doing nothing.
  it('reports a refused edit', async () => {
    const view = await show({ error: 'last-slot' })
    expect(view.getByTestId('settings-error')).toBeTruthy()
    expect(view.getByText('A board needs at least one slot.')).toBeTruthy()
  })

  it('stops offering new Slots once the day column is full', async () => {
    const view = await show({
      slots: [
        ...SLOT_PRESETS,
        { key: brand<string, 'SlotKey'>('ev-t'), labelKey: 'ev-t', label: 'Eväät' },
      ],
    })
    expect(view.queryByTestId('settings-own-name')).toBeNull()
  })

  it('offers an email to someone who has none, and says what it is for', async () => {
    const onAddEmail = jest.fn()
    const view = await show({ account: { isPending: false, onAddEmail } })

    await fireEvent.changeText(view.getByTestId('settings-email-field'), 'aino@example.test')
    await fireEvent.press(view.getByTestId('settings-send-link'))

    expect(onAddEmail).toHaveBeenCalledWith('aino@example.test')
  })

  it('shows the address once it is confirmed, and stops asking', async () => {
    const view = await show({
      account: { email: 'aino@example.test', isPending: false, onAddEmail: jest.fn() },
    })

    expect(view.getByTestId('settings-email')).toBeTruthy()
    expect(view.queryByTestId('settings-email-field')).toBeNull()
  })

  // Given but not clicked: the account is still anonymous, and the screen
  // must not imply otherwise.
  it('keeps asking while an address is only pending', async () => {
    const view = await show({
      account: { pendingEmail: 'aino@example.test', isPending: false, onAddEmail: jest.fn() },
    })

    expect(view.getByTestId('settings-email-pending')).toBeTruthy()
    expect(view.getByTestId('settings-email-field')).toBeTruthy()
  })

  it('offers the board a language, and shows which one it speaks', async () => {
    const onChangeLocale = jest.fn()
    const view = await show({ locale: 'en', onChangeLocale })

    await fireEvent.press(view.getByTestId('settings-language-fi'))

    expect(onChangeLocale).toHaveBeenCalledWith('fi')
  })
})
