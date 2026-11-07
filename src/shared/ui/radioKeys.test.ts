import { radioKeyTarget, rovingTabIndex } from './radioKeys'

describe('radioKeyTarget', () => {
  it('moves forward with the right and down arrows, wrapping at the end', () => {
    expect(radioKeyTarget('ArrowRight', 0, 3)).toBe(1)
    expect(radioKeyTarget('ArrowDown', 2, 3)).toBe(0)
  })

  it('moves back with the left and up arrows, wrapping at the start', () => {
    expect(radioKeyTarget('ArrowLeft', 2, 3)).toBe(1)
    expect(radioKeyTarget('ArrowUp', 0, 3)).toBe(2)
  })

  it('picks the focused option with Space', () => {
    expect(radioKeyTarget(' ', 1, 3)).toBe(1)
  })

  it('leaves every other key alone', () => {
    expect(radioKeyTarget('Tab', 1, 3)).toBeUndefined()
    expect(radioKeyTarget('Enter', 1, 3)).toBeUndefined()
  })
})

describe('rovingTabIndex', () => {
  it('makes only the chosen option a Tab stop', () => {
    expect([0, 1, 2].map((index) => rovingTabIndex(index, 1))).toEqual([-1, 0, -1])
  })

  it('falls back to the first option when nothing is chosen yet', () => {
    expect([0, 1, 2].map((index) => rovingTabIndex(index, -1))).toEqual([0, -1, -1])
  })
})
