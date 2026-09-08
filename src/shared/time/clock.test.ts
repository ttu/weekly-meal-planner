import { fixedClock } from './clock'

describe('fixedClock', () => {
  it('returns the same instant every call', () => {
    const clock = fixedClock('2026-08-26T09:00:00.000Z')
    expect(clock.now().toISOString()).toBe('2026-08-26T09:00:00.000Z')
    expect(clock.now().toISOString()).toBe('2026-08-26T09:00:00.000Z')
  })
})
