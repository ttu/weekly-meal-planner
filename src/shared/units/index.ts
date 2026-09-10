import { ok, err, type Result } from '../types/result'
import { brand } from '../types/brand'
import type { Quantity } from '../types/ids'

/** Mass, volume or count. Quantities convert only within one, which is what
 *  makes the Shopping List's aggregation honest. */
export type Dimension = 'mass' | 'volume' | 'count'

/**
 * A unit belongs to exactly one dimension. The Shopping List's conversion
 * depends on that: 200 g + 0.5 kg sums, 200 g + 2 tbsp does not, and a unit
 * appearing in two dimensions would make the distinction meaningless.
 */
const UNITS = {
  mass: ['g', 'kg'],
  volume: ['ml', 'dl', 'l'],
  count: ['pcs', 'tin', 'pack', 'bunch'],
} as const satisfies Record<Dimension, readonly string[]>

const DIMENSIONS: readonly Dimension[] = ['mass', 'volume', 'count']

export const unitsFor = (dimension: Dimension): readonly string[] => UNITS[dimension]

export const dimensionOf = (unit: string): Dimension | undefined =>
  DIMENSIONS.find((dimension) => UNITS[dimension].some((known) => known === unit))

export type QuantityError = 'not-a-number' | 'not-positive'

/**
 * A Finnish keyboard produces a comma for the decimal separator. Rejecting it
 * is the kind of thing that makes people abandon the one data-entry screen in
 * the app, so both separators are accepted.
 */
export const parseQuantity = (input: string): Result<Quantity, QuantityError> => {
  const normalised = input.trim().replace(',', '.')
  if (normalised.length === 0) return err('not-a-number')

  const value = Number(normalised)
  if (!Number.isFinite(value)) return err('not-a-number')
  if (value <= 0) return err('not-positive')

  return ok(brand<number, 'Quantity'>(value))
}
