import { ok, err, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import { dimensionOf } from '@/shared/units'
import type { Quantity } from '@/shared/types/ids'

/** Factors to each dimension's base unit. `count` units are deliberately absent:
 *  a tin is not a pack, and no factor between them would be honest. */
const TO_BASE: Record<string, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  dl: 100,
  l: 1000,
}

export type ConvertError = 'unknown-unit' | 'different-dimension' | 'not-convertible'

/**
 * Converts within one dimension only. Across dimensions this returns an error
 * rather than a guess: deciding that a tablespoon of flour is 8 g is how a
 * Shopping List quietly becomes wrong.
 */
export const convert = (
  quantity: Quantity,
  from: string,
  to: string,
): Result<Quantity, ConvertError> => {
  if (from === to) return ok(quantity)

  const fromDimension = dimensionOf(from)
  const toDimension = dimensionOf(to)
  if (fromDimension === undefined || toDimension === undefined) return err('unknown-unit')
  if (fromDimension !== toDimension) return err('different-dimension')

  const fromFactor = TO_BASE[from]
  const toFactor = TO_BASE[to]
  // count units have no factors; two different count units cannot be summed.
  if (fromFactor === undefined || toFactor === undefined) return err('not-convertible')

  return ok(brand<number, 'Quantity'>((quantity * fromFactor) / toFactor))
}

export const canConvert = (from: string, to: string): boolean => {
  if (from === to) return true
  const a = dimensionOf(from)
  return (
    a !== undefined &&
    a === dimensionOf(to) &&
    TO_BASE[from] !== undefined &&
    TO_BASE[to] !== undefined
  )
}
