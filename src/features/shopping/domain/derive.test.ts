import { deriveShoppingList, type DeriveInput } from './derive'
import type { IngredientId, MealId, Quantity, Servings } from '@/shared/types/ids'
import type { IngredientInfo, MealIngredient, PlannedMeal } from './types'

const onion: IngredientInfo = {
  id: 'onion' as IngredientId,
  name: 'sipuli',
  category: 'produce',
  dimension: 'count',
  baseUnit: 'pcs',
}
const beef: IngredientInfo = {
  id: 'beef' as IngredientId,
  name: 'jauheliha',
  category: 'meat',
  dimension: 'mass',
  baseUnit: 'g',
}
const cumin: IngredientInfo = {
  id: 'cumin' as IngredientId,
  name: 'juustokumina',
  category: 'spices',
  dimension: 'mass',
  baseUnit: 'g',
}

const chili = (servingsCooked: number): PlannedMeal => ({
  mealId: 'chili' as MealId,
  mealName: 'Chili con carne',
  mealServings: 4 as Servings,
  servingsCooked: servingsCooked as Servings,
})

const mi = (
  mealId: string,
  ingredientId: string,
  quantity: number,
  unit: string,
): MealIngredient => ({
  mealId: mealId as MealId,
  ingredientId: ingredientId as IngredientId,
  quantity: quantity as Quantity,
  unit,
})

const base: DeriveInput = {
  plannedMeals: [],
  mealIngredients: [],
  ingredients: [onion, beef, cumin],
  staples: [],
  overrides: [],
  extras: [],
  checkedIngredientIds: [],
  locale: 'en',
}

describe('deriveShoppingList', () => {
  // The header has to agree with the board above it: two cards, two sittings,
  // even though both are the same Meal.
  it('counts sittings rather than distinct Meals', () => {
    const list = deriveShoppingList({
      plannedMeals: [chili(4), chili(4)],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs')],
      ingredients: [onion],
      staples: [],
      overrides: [],
      checkedIngredientIds: [],
      extras: [],
      locale: 'en',
    })

    expect(list.sittings).toBe(2)
  })

  // Chili on Monday and again on Thursday is two sittings, not four. The
  // Ingredient list belongs to the Meal; the Cook Events say how many times to
  // count it, and nothing may multiply the two together.
  it('counts a Meal planned twice twice, not four times', () => {
    const list = deriveShoppingList({
      plannedMeals: [chili(4), chili(4)],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs')],
      ingredients: [onion],
      staples: [],
      overrides: [],
      checkedIngredientIds: [],
      extras: [],
      locale: 'en',
    })

    expect(list.buy).toHaveLength(1)
    expect(list.buy[0]!.amounts).toEqual([{ quantity: 4, unit: 'pcs' }])
    expect(list.buy[0]!.contributions).toHaveLength(2)
  })

  it('is empty when nothing is planned', () => {
    const list = deriveShoppingList(base)
    expect(list.buy).toHaveLength(0)
    expect(list.incomplete).toHaveLength(0)
  })

  it('lists a planned Meal Ingredients', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(4)],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs')],
    })
    expect(list.buy).toHaveLength(1)
    expect(list.buy[0]!.amounts[0]).toEqual({ quantity: 2, unit: 'pcs' })
  })

  // "Cooking 6" of a Meal that serves 4 needs one and a half times.
  it('scales by servings cooked against the Meal own servings', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(6)],
      mealIngredients: [mi('chili', 'beef', 400, 'g')],
    })
    expect(list.buy[0]!.amounts[0]!.quantity).toBe(600)
  })

  it('sums the same Ingredient across two Meals', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [
        chili(4),
        {
          mealId: 'soup' as MealId,
          mealName: 'Keitto',
          mealServings: 4 as Servings,
          servingsCooked: 4 as Servings,
        },
      ],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs'), mi('soup', 'onion', 3, 'pcs')],
    })
    expect(list.buy).toHaveLength(1)
    expect(list.buy[0]!.amounts[0]!.quantity).toBe(5)
  })

  it('converts within a dimension before summing', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [
        chili(4),
        {
          mealId: 'stew' as MealId,
          mealName: 'Pata',
          mealServings: 4 as Servings,
          servingsCooked: 4 as Servings,
        },
      ],
      mealIngredients: [mi('chili', 'beef', 400, 'g'), mi('stew', 'beef', 0.5, 'kg')],
    })
    expect(list.buy[0]!.amounts).toHaveLength(1)
    expect(list.buy[0]!.amounts[0]).toEqual({ quantity: 900, unit: 'g' })
  })

  // A tin is not a pack; guessing a factor would make the list wrong.
  it('keeps unconvertible units as separate amounts on one line', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [
        chili(4),
        {
          mealId: 'stew' as MealId,
          mealName: 'Pata',
          mealServings: 4 as Servings,
          servingsCooked: 4 as Servings,
        },
      ],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs'), mi('stew', 'onion', 1, 'bunch')],
    })
    expect(list.buy).toHaveLength(1)
    expect(list.buy[0]!.amounts).toHaveLength(2)
  })

  it('keeps a Staple off the Buy list and in the Cupboard Check', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(4)],
      mealIngredients: [mi('chili', 'cumin', 5, 'g')],
      staples: [{ ingredientId: 'cumin' as IngredientId, runningLow: false }],
    })
    expect(list.buy).toHaveLength(0)
    expect(list.cupboard).toHaveLength(1)
    expect(list.cupboard[0]!.name).toBe('juustokumina')
  })

  it('promotes a Staple into Buy when it is running low', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(4)],
      mealIngredients: [mi('chili', 'cumin', 5, 'g')],
      staples: [{ ingredientId: 'cumin' as IngredientId, runningLow: true }],
    })
    expect(list.cupboard).toHaveLength(0)
    expect(list.buy).toHaveLength(1)
    expect(list.buy[0]!.promotedFromCupboard).toBe(true)
  })

  it('lets an Override win, keeping its reason', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(4)],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs')],
      overrides: [
        {
          ingredientId: 'onion' as IngredientId,
          quantity: 6 as Quantity,
          unit: 'pcs',
          reason: 'Iso pussi',
        },
      ],
    })
    expect(list.buy[0]!.amounts[0]!.quantity).toBe(6)
    expect(list.buy[0]!.isOverridden).toBe(true)
    expect(list.buy[0]!.overrideReason).toBe('Iso pussi')
  })

  // The gap is visible before the shop rather than at the stove.
  it('surfaces a planned Meal with no Ingredients', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [
        {
          mealId: 'tacos' as MealId,
          mealName: 'Tacos',
          mealServings: 4 as Servings,
          servingsCooked: 4 as Servings,
        },
      ],
    })
    expect(list.buy).toHaveLength(0)
    expect(list.incomplete).toEqual([
      { mealId: 'tacos', mealName: 'Tacos', reason: 'no-ingredients' },
    ])
  })

  it('records which Meals contributed, for the "why four onions?" question', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [
        chili(4),
        {
          mealId: 'soup' as MealId,
          mealName: 'Keitto',
          mealServings: 4 as Servings,
          servingsCooked: 4 as Servings,
        },
      ],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs'), mi('soup', 'onion', 3, 'pcs')],
    })
    expect(list.buy[0]!.contributions).toEqual([
      { mealName: 'Chili con carne', quantity: 2, unit: 'pcs' },
      { mealName: 'Keitto', quantity: 3, unit: 'pcs' },
    ])
  })

  it('marks ticked lines without removing them', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(4)],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs')],
      checkedIngredientIds: ['onion' as IngredientId],
    })
    expect(list.buy).toHaveLength(1)
    expect(list.buy[0]!.checked).toBe(true)
  })

  it('groups by category so the list follows the shop', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(4)],
      mealIngredients: [mi('chili', 'beef', 400, 'g'), mi('chili', 'onion', 2, 'pcs')],
    })
    expect(list.buy.map((l) => l.category)).toEqual(['meat', 'produce'])
  })

  it('rounds scaled amounts to something a person can read', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(3)],
      mealIngredients: [mi('chili', 'beef', 400, 'g')],
    })
    expect(list.buy[0]!.amounts[0]!.quantity).toBe(300)
  })

  // 533.33 g is not something a shop sells; 533 g is close enough.
  it('rounds grams to whole numbers, keeping each Meal its exact share', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(4 / 3)],
      mealIngredients: [mi('chili', 'beef', 400, 'g')],
    })
    expect(list.buy[0]!.amounts[0]!.quantity).toBe(133)
    expect(list.buy[0]!.contributions[0]!.quantity).toBeCloseTo(133.33, 2)

    const more = deriveShoppingList({
      ...base,
      plannedMeals: [{ ...chili(4), mealServings: 3 as Servings }],
      mealIngredients: [mi('chili', 'beef', 400, 'g')],
    })
    expect(more.buy[0]!.amounts[0]!.quantity).toBe(533)
  })

  // Nobody buys three quarters of a tin.
  it('rounds count units up', () => {
    const list = deriveShoppingList({
      ...base,
      ingredients: [{ ...onion, id: 'tomatoes' as IngredientId, baseUnit: 'tin' }],
      plannedMeals: [chili(3)],
      mealIngredients: [mi('chili', 'tomatoes', 1, 'tin')],
    })
    expect(list.buy[0]!.amounts[0]).toEqual({ quantity: 1, unit: 'tin' })
    expect(list.buy[0]!.contributions[0]!.quantity).toBe(0.75)
  })

  it('rounds kilograms and litres to one decimal', () => {
    const list = deriveShoppingList({
      ...base,
      ingredients: [{ ...beef, baseUnit: 'kg' }],
      plannedMeals: [chili(3)],
      mealIngredients: [mi('chili', 'beef', 1.1, 'kg')],
    })
    expect(list.buy[0]!.amounts[0]).toEqual({ quantity: 0.8, unit: 'kg' })
  })

  // The order Meals arrive in must not decide the unit: 200 g + 1 kg and
  // 1 kg + 200 g are the same shop.
  it('sums in the Ingredient base unit, whatever unit came first', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [
        chili(4),
        {
          mealId: 'stew' as MealId,
          mealName: 'Pata',
          mealServings: 4 as Servings,
          servingsCooked: 4 as Servings,
        },
      ],
      mealIngredients: [mi('chili', 'beef', 1, 'kg'), mi('stew', 'beef', 200, 'g')],
    })
    expect(list.buy[0]!.amounts).toEqual([{ quantity: 1200, unit: 'g' }])
  })

  // Another Member's newer build can name an Ingredient this one does not
  // know. Dropping it silently would hand the family a short list.
  it('flags a Meal that names an Ingredient this build does not know', () => {
    const list = deriveShoppingList({
      ...base,
      plannedMeals: [chili(4)],
      mealIngredients: [mi('chili', 'onion', 2, 'pcs'), mi('chili', 'saffron', 1, 'g')],
    })
    expect(list.buy.map((l) => l.ingredientId)).toEqual(['onion'])
    expect(list.incomplete).toEqual([
      { mealId: 'chili', mealName: 'Chili con carne', reason: 'unknown-ingredient' },
    ])
  })

  // In Finnish ä sorts after z; a default sort files "äyriäiset" under a.
  it('sorts names in the Household Locale', () => {
    const named = (id: string, name: string): IngredientInfo => ({
      ...onion,
      id: id as IngredientId,
      name,
    })
    const list = deriveShoppingList({
      ...base,
      locale: 'fi',
      ingredients: [named('a', 'äyriäiset'), named('z', 'zucchini')],
      plannedMeals: [chili(4)],
      mealIngredients: [mi('chili', 'a', 1, 'pcs'), mi('chili', 'z', 1, 'pcs')],
    })
    expect(list.buy.map((l) => l.name)).toEqual(['zucchini', 'äyriäiset'])
  })
})
