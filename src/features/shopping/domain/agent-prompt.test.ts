import { buildAgentPrompt } from './agent-prompt'
import type { IngredientId, Quantity } from '@/shared/types/ids'
import type { ExtraId } from './types'
import type { ShoppingList } from './types'

const list: ShoppingList = {
  sittings: 2,
  buy: [
    {
      ingredientId: 'onion' as IngredientId,
      name: 'sipuli',
      category: 'produce',
      amounts: [{ quantity: 4 as Quantity, unit: 'pcs' }],
      contributions: [{ mealName: 'Chili con carne', quantity: 4 as Quantity, unit: 'pcs' }],
      isOverridden: false,
      promotedFromCupboard: false,
      checked: false,
    },
    {
      ingredientId: 'beef' as IngredientId,
      name: 'jauheliha',
      category: 'meat',
      amounts: [{ quantity: 400 as Quantity, unit: 'g' }],
      contributions: [{ mealName: 'Chili con carne', quantity: 400 as Quantity, unit: 'g' }],
      isOverridden: false,
      promotedFromCupboard: false,
      checked: true,
    },
  ],
  cupboard: [{ ingredientId: 'cumin' as IngredientId, name: 'juustokumina', category: 'spices' }],
  extras: [
    { id: 'e1' as ExtraId, label: 'Roskapussit', checked: false },
    { id: 'e2' as ExtraId, label: 'Jo ostettu', checked: true },
  ],
  incomplete: [],
}

describe('buildAgentPrompt', () => {
  it('lists Buy items with their amounts', () => {
    expect(buildAgentPrompt(list, 'Tilaa:')).toContain('- 4 pcs sipuli')
  })

  it('includes unticked Extras', () => {
    expect(buildAgentPrompt(list, 'Tilaa:')).toContain('- Roskapussit')
  })

  it('leaves out Extras already ticked off', () => {
    expect(buildAgentPrompt(list, 'Tilaa:')).not.toContain('Jo ostettu')
  })

  // A ticked line is already in the basket. Asking an agent to order it again
  // is how a household ends up with two of everything they shopped for first.
  it('leaves out Buy Lines already ticked off', () => {
    expect(buildAgentPrompt(list, 'Tilaa:')).not.toContain('jauheliha')
  })

  // The Cupboard Check is a question for the family, not an order for a shop.
  it('leaves out the Cupboard Check', () => {
    expect(buildAgentPrompt(list, 'Tilaa:')).not.toContain('juustokumina')
  })

  // The clipboard is the least private place in the system.
  it('carries no Member names, Household id or URL', () => {
    const prompt = buildAgentPrompt(list, 'Tilaa:')
    expect(prompt).not.toMatch(/https?:\/\//)
    expect(prompt).not.toContain('Aino')
  })
})
