import { groupBuyLines } from './group'
import type { BuyLine } from './types'
import { brand } from '@/shared/types/brand'

const line = (name: string, category: string, meals: readonly string[] = []): BuyLine => ({
  ingredientId: brand<string, 'IngredientId'>(name),
  name,
  category,
  amounts: [{ quantity: brand<number, 'Quantity'>(1), unit: 'pcs' }],
  contributions: meals.map((mealName) => ({
    mealName,
    quantity: brand<number, 'Quantity'>(1),
    unit: 'pcs',
  })),
  isOverridden: false,
  promotedFromCupboard: false,
  checked: false,
})

describe('groupBuyLines', () => {
  it('puts every Buy Line of a category together', () => {
    const groups = groupBuyLines([
      line('onion', 'produce'),
      line('milk', 'dairy'),
      line('carrot', 'produce'),
    ])

    expect(groups).toEqual([
      {
        category: 'produce',
        lines: [
          expect.objectContaining({ name: 'onion' }),
          expect.objectContaining({ name: 'carrot' }),
        ],
      },
      { category: 'dairy', lines: [expect.objectContaining({ name: 'milk' })] },
    ])
  })

  it('keeps categories in the order they first appear', () => {
    const groups = groupBuyLines([line('milk', 'dairy'), line('onion', 'produce')])

    expect(groups.map((g) => g.category)).toEqual(['dairy', 'produce'])
  })

  it('has no groups for an empty list', () => {
    expect(groupBuyLines([])).toEqual([])
  })
})
