import { act, renderHook, waitFor } from '@testing-library/react-native'
import { randomBytes } from '@noble/hashes/utils'
import { testBoard } from '@/test/test-board'
import { brand } from '@/shared/types/brand'
import { isErr, isOk } from '@/shared/types/result'
import type { HouseholdId } from '@/shared/types/ids'
import { useHouseholdMeals } from '../ui/useHouseholdMeals'
import { copyCatalogueMeal, deleteMeal, getMeal, listMeals, saveMeal } from './meals-data'

const HOUSEHOLD = brand<string, 'HouseholdId'>('h') as HouseholdId
const draft = (over: Record<string, unknown> = {}) => ({
  name: 'Soup',
  servings: brand<number, 'Servings'>(4),
  ingredients: [
    {
      ingredientId: brand<string, 'IngredientId'>('onion'),
      quantity: brand<number, 'Quantity'>(2),
      unit: 'pcs',
    },
  ],
  ...over,
})

describe('Household Meals on the synced board', () => {
  it('saves a Meal and reads it back, with its Ingredients', async () => {
    const { data } = await testBoard()
    const saved = await saveMeal(data, randomBytes, draft())
    if (!isOk(saved)) throw new Error('not saved')
    const meal = getMeal(data, HOUSEHOLD, 'en', saved.value)
    expect(meal).toMatchObject({ name: 'Soup', ingredientCount: 1 })
    expect(meal?.ingredients[0]).toMatchObject({ ingredientId: 'onion', unit: 'pcs' })
  })

  it('lists the Household’s own Meals and the Catalogue in its Locale', async () => {
    const { data } = await testBoard()
    await saveMeal(data, randomBytes, draft())
    const en = listMeals(data, HOUSEHOLD, 'en')
    expect(en.some((m) => m.name === 'Soup' && m.householdId === HOUSEHOLD)).toBe(true)
    expect(en.some((m) => m.name === 'Chili con carne' && m.householdId === undefined)).toBe(true)
    expect(listMeals(data, HOUSEHOLD, 'fi').some((m) => m.name === 'Soup')).toBe(true)
  })

  it('edits a Meal in place rather than making another', async () => {
    const { data } = await testBoard()
    const first = await saveMeal(data, randomBytes, draft())
    if (!isOk(first)) throw new Error('not saved')
    await saveMeal(data, randomBytes, draft({ id: first.value, name: 'Better soup' }))
    const own = listMeals(data, HOUSEHOLD, 'en').filter((m) => m.householdId !== undefined)
    expect(own.map((m) => m.name)).toEqual(['Better soup'])
  })

  it('refuses a Meal with no name, a repeated Ingredient, or a unit from another dimension', async () => {
    const { data } = await testBoard()
    const onion = draft().ingredients[0]
    const refused = async (over: Record<string, unknown>) => {
      const result = await saveMeal(data, randomBytes, draft(over))
      return isErr(result) ? result.error : 'saved'
    }
    expect(await refused({ name: '  ' })).toBe('name-required')
    expect(await refused({ ingredients: [onion, onion] })).toBe('duplicate-ingredient')
    expect(await refused({ ingredients: [{ ...onion, unit: 'kg' }] })).toBe('invalid-ingredient')
    expect(
      await refused({
        ingredients: [{ ...onion, ingredientId: brand<string, 'IngredientId'>('nope') }],
      }),
    ).toBe('invalid-ingredient')
    expect(listMeals(data, HOUSEHOLD, 'en').filter((m) => m.householdId !== undefined)).toEqual([])
  })

  it('never edits a Catalogue Meal', async () => {
    const { data } = await testBoard()
    const catalogue = listMeals(data, HOUSEHOLD, 'en').find((m) => m.householdId === undefined)
    if (!catalogue) throw new Error('no catalogue')
    const result = await saveMeal(data, randomBytes, draft({ id: catalogue.id }))
    expect(isErr(result)).toBe(true)
  })

  it('copies a Catalogue Meal into the Household, named in its Locale', async () => {
    const { data } = await testBoard()
    const source = listMeals(data, HOUSEHOLD, 'fi').find((m) => m.name === 'Chili con carne')
    if (!source) throw new Error('no source')
    const copied = await copyCatalogueMeal(data, randomBytes, 'fi', source.id)
    if (!isOk(copied)) throw new Error('not copied')
    const copy = getMeal(data, HOUSEHOLD, 'fi', copied.value)
    expect(copy).toMatchObject({ name: 'Chili con carne', householdId: HOUSEHOLD })
    expect(copy?.ingredientCount).toBeGreaterThan(0)
  })

  it('deletes a Meal', async () => {
    const { data } = await testBoard()
    const saved = await saveMeal(data, randomBytes, draft())
    if (!isOk(saved)) throw new Error('not saved')
    await deleteMeal(data, saved.value)
    expect(getMeal(data, HOUSEHOLD, 'en', saved.value)).toBeUndefined()
  })

  it('leaves out a row another Member wrote that makes no sense', async () => {
    const { data } = await testBoard()
    await data.put('meal', 'junk', { name: '', servings: 'lots' })
    await saveMeal(data, randomBytes, draft())
    expect(
      listMeals(data, HOUSEHOLD, 'en').filter((m) => m.householdId !== undefined),
    ).toHaveLength(1)
  })

  // One bad element must not blank the Meal, or the next save writes [] over
  // the real list.
  it('drops only the Ingredient that does not parse, keeping the rest', async () => {
    const { data } = await testBoard()
    await data.put('meal', 'm1', {
      name: 'Soup',
      servings: 4,
      ingredients: [
        { ingredientId: 'onion', quantity: 2, unit: 'pcs', optional: true },
        { ingredientId: 'carrot', quantity: -1, unit: 'pcs' },
      ],
    })
    expect(getMeal(data, HOUSEHOLD, 'en', brand<string, 'MealId'>('m1'))?.ingredients).toEqual([
      { ingredientId: 'onion', quantity: 2, unit: 'pcs' },
    ])
  })
})

describe('useHouseholdMeals', () => {
  it('follows the board: a Meal saved elsewhere appears', async () => {
    const { data, wrapper } = await testBoard()
    const view = await renderHook(() => useHouseholdMeals(), { wrapper })
    await waitFor(() => {
      expect(view.result.current.hasData).toBe(true)
    })
    expect(view.result.current.meals.some((m) => m.name === 'Soup')).toBe(false)
    await act(async () => {
      await saveMeal(data, randomBytes, draft())
    })
    await waitFor(() => {
      expect(view.result.current.meals.some((m) => m.name === 'Soup')).toBe(true)
    })
  })
})
