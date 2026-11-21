import {
  MAX_COUNTER,
  MAX_DRIFT_MS,
  compareHlc,
  isValidHlc,
  receiveHlc,
  tickHlc,
  type Hlc,
} from './hlc'

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

  it('starts over from the wall clock when it was further ahead than any device accepts', () => {
    const ahead = 1000 + MAX_DRIFT_MS + 1
    expect(tickHlc(at(ahead, 5, 'a'), 1000).wall).toBe(1000)
    expect(receiveHlc(at(ahead, 5, 'a'), at(900, 0, 'b'), 1000).wall).toBe(1000)
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
    expect(() => receiveHlc(at(100, 0, 'a'), at(100 + 25 * 3600_000, 0, 'b'), 100)).toThrow(/ahead/)
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

describe('isValidHlc', () => {
  it('accepts a well-formed stamp', () => {
    expect(isValidHlc(at(1, 0, 'a'))).toBe(true)
  })

  it.each([
    ['NaN wall', at(Number.NaN, 0, 'a')],
    ['infinite wall', at(Infinity, 0, 'a')],
    ['negative wall', at(-1, 0, 'a')],
    ['fractional counter', at(1, 0.5, 'a')],
    ['unsafe integer', at(Number.MAX_SAFE_INTEGER + 2, 0, 'a')],
    ['empty node', at(1, 0, '')],
  ])('rejects %s, which would poison every comparison', (_name, hlc) => {
    expect(isValidHlc(hlc)).toBe(false)
  })

  it('is what receiveHlc relies on, so a malformed remote stamp is refused', () => {
    expect(() => receiveHlc(at(1, 0, 'a'), at(Number.NaN, 0, 'b'), 1)).toThrow(/invalid/)
  })
})

describe('counter cap', () => {
  it('rolls into the next millisecond instead of growing without bound', () => {
    expect(tickHlc(at(100, MAX_COUNTER, 'a'), 100)).toEqual(at(101, 0, 'a'))
  })

  it('does the same when receiving', () => {
    const next = receiveHlc(at(100, MAX_COUNTER, 'a'), at(100, 0, 'b'), 100)
    expect(next).toEqual(at(101, 0, 'a'))
  })

  it('rejects a remote counter above the cap', () => {
    expect(isValidHlc(at(1, MAX_COUNTER + 1, 'a'))).toBe(false)
  })
})

describe('isValidHlc on untrusted input', () => {
  it.each([null, undefined, 'x', 7, {}, { wall: 1, counter: 0, node: 5 }])(
    'rejects %j without throwing',
    (value) => {
      expect(isValidHlc(value)).toBe(false)
    },
  )
})
