import { unitsFor, dimensionOf, parseQuantity } from './units'
import { isOk, isErr } from '@/shared/types/result'

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
