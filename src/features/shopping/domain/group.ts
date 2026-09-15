import type { BuyLine } from './types'

export type BuyGroup = {
  readonly category: string
  readonly lines: readonly BuyLine[]
}

/**
 * Buy Lines in the order the shop is walked, one group per category.
 *
 * Grouping is a shopping aid, not decoration: produce is at one end of the shop
 * and dry goods at the other, and a flat list makes a person cross the floor
 * once per Meal. Categories keep the order they first appear in, which is the
 * order the derivation produced — stable between renders and between people.
 */
export const groupBuyLines = (lines: readonly BuyLine[]): readonly BuyGroup[] => {
  const order: string[] = []
  const byCategory = new Map<string, BuyLine[]>()

  for (const line of lines) {
    const existing = byCategory.get(line.category)
    if (existing === undefined) {
      order.push(line.category)
      byCategory.set(line.category, [line])
    } else {
      existing.push(line)
    }
  }

  return order.map((category) => ({ category, lines: byCategory.get(category) ?? [] }))
}

/** How many Meals this list is for — the second half of "18 to buy · 6 meals". */
export const countMealsBehind = (lines: readonly BuyLine[]): number =>
  new Set(lines.flatMap((line) => line.contributions.map((c) => c.mealName))).size
