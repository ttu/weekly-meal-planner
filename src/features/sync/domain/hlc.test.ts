import { compareHlc, receiveHlc, tickHlc, type Hlc } from './hlc'

const at = (wall: number, counter: number, node: string): Hlc => ({ wall, counter, node })

describe('tickHlc', () => {
  it('follows the wall clock when it moves forward', () => {
    expect(tickHlc(at(100, 5, 'a'), 200)).toEqual(at(200, 0, 'a'))
  })

  it('counts up when the wall clock has not moved, so two writes never tie', () => {
    expect(tickHlc(at(100, 5, 'a'), 100)).toEqual(at(100, 6, 'a'))
  })

  it('counts up when the wall clock went backwards, so time never runs backwards', () => {
    expect(tickHlc(at(100, 5, 'a'), 50)).toEqual(at(100, 6, 'a'))
  })
})

describe('receiveHlc', () => {
  it('moves past a remote stamp that is ahead of ours', () => {
    const next = receiveHlc(at(100, 0, 'a'), at(300, 2, 'b'), 150)
    expect(compareHlc(next, at(300, 2, 'b'))).toBeGreaterThan(0)
    expect(next.node).toBe('a')
  })

  it('still moves forward when the remote is behind', () => {
    const next = receiveHlc(at(100, 4, 'a'), at(10, 0, 'b'), 90)
    expect(compareHlc(next, at(100, 4, 'a'))).toBeGreaterThan(0)
  })

  it('refuses a remote stamp absurdly far in the future', () => {
    // A Member with a wrong clock must not drag every other clock years ahead.
    expect(() => receiveHlc(at(100, 0, 'a'), at(100 + 24 * 3600_000 * 400, 0, 'b'), 100)).toThrow(
      /ahead/,
    )
  })
})

describe('compareHlc', () => {
  it('orders by wall, then counter, then node so every client agrees', () => {
    expect(compareHlc(at(1, 0, 'a'), at(2, 0, 'a'))).toBeLessThan(0)
    expect(compareHlc(at(1, 1, 'a'), at(1, 0, 'z'))).toBeGreaterThan(0)
    expect(compareHlc(at(1, 1, 'a'), at(1, 1, 'b'))).toBeLessThan(0)
    expect(compareHlc(at(1, 1, 'a'), at(1, 1, 'a'))).toBe(0)
  })
})
