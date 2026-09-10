import { buildAgentPrompt } from './agent-prompt'
import type { IngredientId, Quantity } from '@/shared/types/ids'
import type { ExtraId } from './types'
import type { ShoppingList } from './types'

const list: ShoppingList = {
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
