import { brand } from '@/shared/types/brand'
import { DEFAULT_SIZE, MAX_SIZE, MIN_SIZE, stepSize } from './size'
import type { HouseholdSize } from './types'

const size = (n: number): HouseholdSize => brand<number, 'HouseholdSize'>(n)

describe('stepSize', () => {
  it('moves by one', () => {
    expect(stepSize(DEFAULT_SIZE, 1)).toBe(DEFAULT_SIZE + 1)
    expect(stepSize(DEFAULT_SIZE, -1)).toBe(DEFAULT_SIZE - 1)
  })

  // A household of nobody has nothing to cook for.
  it('stops at the smallest household', () => {
    expect(stepSize(size(MIN_SIZE), -1)).toBe(MIN_SIZE)
  })

  it('stops at the largest, which is what a Meal can serve', () => {
    expect(stepSize(size(MAX_SIZE), 1)).toBe(MAX_SIZE)
  })
})
