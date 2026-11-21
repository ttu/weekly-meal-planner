import type { IngredientId, Quantity } from '@/shared/types/ids'
import { formatAmounts, isEmptyList, stillToBuy } from './summary'
import type { BuyLine, ExtraId, ShoppingList } from './types'

const empty: ShoppingList = { sittings: 0, buy: [], cupboard: [], extras: [], incomplete: [] }
const line = (checked: boolean): BuyLine => ({
  ingredientId: 'onion' as IngredientId,
  name: 'onion',
  category: 'produce',
  amounts: [],
  contributions: [],
  isOverridden: false,
  promotedFromCupboard: false,
  checked,
})
const coffee = { id: 'e1' as ExtraId, label: 'Coffee', checked: false }

describe('stillToBuy', () => {
  it('counts unticked Buy Lines and unticked Extras', () => {
    expect(
      stillToBuy({
        ...empty,
        buy: [line(false), line(true)],
        extras: [coffee, { ...coffee, checked: true }],
      }),
    ).toBe(2)
  })
})

describe('isEmptyList', () => {
  it('is empty with nothing in any section', () => {
    expect(isEmptyList(empty)).toBe(true)
  })

  it('is not empty with only an Extra', () => {
    expect(isEmptyList({ ...empty, extras: [coffee] })).toBe(false)
  })
})

describe('formatAmounts', () => {
  const amounts = [
    { quantity: 1.5 as Quantity, unit: 'kg' },
    { quantity: 2 as Quantity, unit: 'tbsp' },
  ]
  const label = (unit: string): string => unit

  it('writes a Finnish decimal comma', () => {
    expect(formatAmounts(amounts, label, 'fi')).toBe('1,5 kg + 2 tbsp')
  })

  it('writes an English decimal point', () => {
    expect(formatAmounts(amounts, label, 'en')).toBe('1.5 kg + 2 tbsp')
  })
})
