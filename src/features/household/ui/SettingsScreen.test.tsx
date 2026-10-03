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

const show = async (over: Partial<Parameters<typeof SettingsScreen>[0]> = {}) =>
  renderWithProviders(
    <SettingsScreen
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
})
