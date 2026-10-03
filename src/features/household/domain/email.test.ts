import { isPlausibleEmail } from './email'

describe('isPlausibleEmail', () => {
  it('accepts an ordinary address', () => {
    expect(isPlausibleEmail('aino@example.test')).toBe(true)
  })

  it('ignores the spaces a phone keyboard adds', () => {
    expect(isPlausibleEmail('  aino@example.test ')).toBe(true)
  })

  it('accepts the plus and dots people actually use', () => {
    expect(isPlausibleEmail('aino.koivisto+meals@example.co.uk')).toBe(true)
  })

  it('rejects what is obviously not an address', () => {
    expect(isPlausibleEmail('aino')).toBe(false)
    expect(isPlausibleEmail('aino@example')).toBe(false)
    expect(isPlausibleEmail('ai no@example.test')).toBe(false)
    expect(isPlausibleEmail('')).toBe(false)
  })
})
