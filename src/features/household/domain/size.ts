import { brand } from '@/shared/types/brand'
import type { HouseholdSize } from './types'

export const MIN_SIZE = 1
/** The same ceiling as `meal.servings`: a household bigger than one Meal can
 *  feed would start every Meal at a number the editor refuses. */
export const MAX_SIZE = 50
export const DEFAULT_SIZE: HouseholdSize = brand<number, 'HouseholdSize'>(4)

export const stepSize = (size: HouseholdSize, by: -1 | 1): HouseholdSize =>
  brand<number, 'HouseholdSize'>(Math.min(MAX_SIZE, Math.max(MIN_SIZE, size + by)))
