import { unitsFor, dimensionOf, defaultAmountFor, parseQuantity } from './index'
import { isOk, isErr } from '../types/result'

describe('unitsFor', () => {
  it('lists mass units', () => {
    expect(unitsFor('mass')).toEqual(['g', 'kg'])
  })

  it('lists volume units', () => {
    expect(unitsFor('volume')).toEqual(['ml', 'dl', 'l'])
  })

  it('lists count units', () => {
    expect(unitsFor('count')).toEqual(['pcs', 'tin', 'pack', 'bunch'])
  })
})

describe('dimensionOf', () => {
  // Plan 04's conversion depends on this being unambiguous.
  it('maps every unit to exactly one dimension', () => {
    const all = [...unitsFor('mass'), ...unitsFor('volume'), ...unitsFor('count')]
    expect(new Set(all).size).toBe(all.length)
    for (const unit of all) expect(dimensionOf(unit)).toBeDefined()
  })

  it('returns undefined for an unknown unit', () => {
    expect(dimensionOf('tbsp')).toBeUndefined()
  })
})

describe('parseQuantity', () => {
  it('accepts a whole number', () => {
    const result = parseQuantity('400')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toBe(400)
  })

  it('accepts a decimal point', () => {
    const result = parseQuantity('0.5')
    if (isOk(result)) expect(result.value).toBe(0.5)
  })

  // A Finnish keyboard produces a comma.
  it('accepts a decimal comma', () => {
    const result = parseQuantity('0,5')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toBe(0.5)
  })

  it('ignores surrounding whitespace', () => {
    expect(isOk(parseQuantity('  2 '))).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isErr(parseQuantity(''))).toBe(true)
  })

  it('rejects text', () => {
    expect(isErr(parseQuantity('kaksi'))).toBe(true)
  })

  // quantity has a `> 0` check constraint; catching it here gives an
  // explainable message instead of an opaque database error.
  it('rejects zero and negatives', () => {
    expect(isErr(parseQuantity('0'))).toBe(true)
    expect(isErr(parseQuantity('-3'))).toBe(true)
  })
})

describe('defaultAmountFor', () => {
  // One gram of potato is the number the editor used to offer.
  it('starts a mass row at an amount someone might cook with', () => {
    expect(defaultAmountFor('mass')).toEqual({ quantity: 200, unit: 'g' })
  })

  it('starts a volume row in decilitres, not millilitres', () => {
    expect(defaultAmountFor('volume')).toEqual({ quantity: 2, unit: 'dl' })
  })

  it('starts a count row at one, where one is the right answer', () => {
    expect(defaultAmountFor('count')).toEqual({ quantity: 1, unit: 'pcs' })
  })

  it('only ever offers a unit of the right dimension', () => {
    for (const dimension of ['mass', 'volume', 'count'] as const) {
      expect(dimensionOf(defaultAmountFor(dimension).unit)).toBe(dimension)
    }
  })
})
