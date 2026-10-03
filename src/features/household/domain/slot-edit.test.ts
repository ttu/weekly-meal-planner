import { brand } from '@/shared/types/brand'
import { isErr, isOk } from '@/shared/types/result'
import {
  MAX_SLOTS,
  SLOT_PRESETS,
  addNamedSlot,
  addPresetSlot,
  moveSlot,
  removeSlot,
  slotName,
} from './slot-edit'
import type { Slot, SlotKey } from './types'

const key = (value: string): SlotKey => brand<string, 'SlotKey'>(value)
const preset = (name: string): Slot => {
  const found = SLOT_PRESETS.find((s) => s.key === key(name))
  if (found === undefined) throw new Error(`No preset ${name}`)
  return found
}

const DEFAULTS: readonly Slot[] = [preset('lunch'), preset('dinner')]
const unwrap = (result: ReturnType<typeof addPresetSlot>): readonly Slot[] => {
  if (!isOk(result)) throw new Error('Expected an edit to be allowed')
  return result.value
}

describe('slotName', () => {
  it('translates a preset', () => {
    expect(slotName(preset('lunch'), () => 'Lounas')).toBe('Lounas')
  })

  // A household's own word is already in their language; translating it would
  // hand back the key.
  it("leaves a household's own word alone", () => {
    expect(slotName({ labelKey: 'evaat', label: 'Eväät' }, () => 'nope')).toBe('Eväät')
  })
})

describe('addPresetSlot', () => {
  it('appends the Slot', () => {
    expect(unwrap(addPresetSlot(DEFAULTS, preset('breakfast'))).map((s) => s.key)).toEqual([
      'lunch',
      'dinner',
      'breakfast',
    ])
  })

  it('refuses one the board already has', () => {
    expect(addPresetSlot(DEFAULTS, preset('lunch'))).toEqual({
      kind: 'err',
      error: 'duplicate-slot',
    })
  })

  it('refuses to make the day longer than a phone column', () => {
    const full = SLOT_PRESETS.slice(0, MAX_SLOTS)
    expect(isErr(addPresetSlot(full, preset('lunch')))).toBe(true)
  })
})

describe('addNamedSlot', () => {
  it("keys a household's own Slot off what they called it", () => {
    const slots = unwrap(addNamedSlot(DEFAULTS, '  Eväät  '))
    expect(slots[2]).toEqual({ key: 'ev-t', labelKey: 'ev-t', label: 'Eväät' })
  })

  it('keeps two Slots with the same name apart', () => {
    const once = unwrap(addNamedSlot(DEFAULTS, 'Snack'))
    expect(unwrap(addNamedSlot(once, 'Snack'))[3]?.key).toBe('snack-2')
  })

  it('refuses a name that is only spaces', () => {
    expect(addNamedSlot(DEFAULTS, '   ')).toEqual({ kind: 'err', error: 'name-required' })
  })

  // Punctuation alone cannot produce a key, and an empty key would collide
  // with the next one.
  it('falls back to a usable key when the name has no letters', () => {
    expect(unwrap(addNamedSlot(DEFAULTS, '🍲'))[2]?.key).toBe('slot')
  })
})

describe('removeSlot', () => {
  it('drops the Slot', () => {
    expect(unwrap(removeSlot(DEFAULTS, key('lunch'))).map((s) => s.key)).toEqual(['dinner'])
  })

  it('refuses to leave the board with nowhere to put a Meal', () => {
    expect(removeSlot([preset('dinner')], key('dinner'))).toEqual({
      kind: 'err',
      error: 'last-slot',
    })
  })
})

describe('moveSlot', () => {
  it('moves a Slot earlier in the day', () => {
    expect(moveSlot(DEFAULTS, key('dinner'), -1).map((s) => s.key)).toEqual(['dinner', 'lunch'])
  })

  it('moves a Slot later in the day', () => {
    expect(moveSlot(DEFAULTS, key('lunch'), 1).map((s) => s.key)).toEqual(['dinner', 'lunch'])
  })

  it('does nothing at either end', () => {
    expect(moveSlot(DEFAULTS, key('lunch'), -1)).toEqual(DEFAULTS)
    expect(moveSlot(DEFAULTS, key('dinner'), 1)).toEqual(DEFAULTS)
  })

  it('does nothing for a Slot that is not there', () => {
    expect(moveSlot(DEFAULTS, key('brunch'), 1)).toEqual(DEFAULTS)
  })
})
