import { convert, canConvert } from './convert'
import { isOk, isErr } from '@/shared/types/result'
import type { Quantity } from '@/shared/types/ids'

const q = (n: number): Quantity => n as Quantity

describe('convert', () => {
  it('is identity for the same unit', () => {
    const result = convert(q(200), 'g', 'g')
    if (isOk(result)) expect(result.value).toBe(200)
  })

  it('converts kg to g', () => {
    const result = convert(q(0.5), 'kg', 'g')
    if (isOk(result)) expect(result.value).toBe(500)
  })

  it('converts g to kg', () => {
    const result = convert(q(1500), 'g', 'kg')
    if (isOk(result)) expect(result.value).toBe(1.5)
  })

  it('converts within volume', () => {
    const result = convert(q(2), 'dl', 'ml')
    if (isOk(result)) expect(result.value).toBe(200)
  })

  // Guessing a gram weight for a tablespoon is how a list quietly becomes wrong.
  it('refuses to cross dimensions', () => {
    const result = convert(q(200), 'g', 'ml')
    expect(isErr(result)).toBe(true)
    if (isErr(result)) expect(result.error).toBe('different-dimension')
  })

  // A tin is not a pack.
  it('refuses to convert between count units', () => {
    expect(isErr(convert(q(2), 'tin', 'pack'))).toBe(true)
  })

  it('rejects an unknown unit', () => {
    expect(isErr(convert(q(1), 'tbsp', 'g'))).toBe(true)
  })
})

describe('canConvert', () => {
  it('agrees with convert', () => {
    expect(canConvert('g', 'kg')).toBe(true)
    expect(canConvert('pcs', 'pcs')).toBe(true)
    expect(canConvert('tin', 'pack')).toBe(false)
    expect(canConvert('g', 'ml')).toBe(false)
  })
})
