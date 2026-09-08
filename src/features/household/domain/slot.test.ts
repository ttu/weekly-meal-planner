import { parseSlots } from './slot'
import { isOk, isErr } from '@/shared/types/result'

describe('parseSlots', () => {
  it('accepts the default lunch and dinner Slots', () => {
    const result = parseSlots([
      { key: 'lunch', labelKey: 'slot.lunch' },
      { key: 'dinner', labelKey: 'slot.dinner' },
    ])
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.map((s) => s.key)).toEqual(['lunch', 'dinner'])
  })

  it('preserves order, because the board renders Slots as configured', () => {
    const result = parseSlots([
      { key: 'dinner', labelKey: 'slot.dinner' },
      { key: 'lunch', labelKey: 'slot.lunch' },
    ])
    if (isOk(result)) expect(result.value.map((s) => s.key)).toEqual(['dinner', 'lunch'])
  })

  it('rejects duplicate keys', () => {
    expect(
      isErr(
        parseSlots([
          { key: 'lunch', labelKey: 'slot.lunch' },
          { key: 'lunch', labelKey: 'slot.lunch' },
        ]),
      ),
    ).toBe(true)
  })

  it('rejects a non-array', () => {
    expect(isErr(parseSlots('lunch,dinner'))).toBe(true)
  })

  it('rejects a Slot without a label key', () => {
    expect(isErr(parseSlots([{ key: 'lunch' }]))).toBe(true)
  })
})
