import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { err, isErr, ok, type Result } from '@/shared/types/result'
import { dimensionOf, unitsFor } from '@/shared/units'
import type { Locale } from '@/shared/i18n'
import { newId, type Data, type Random } from '@/features/sync'
import { catalogueIngredients, catalogueMeals } from '../domain/catalogue'
import { validateMealDraft, type MealDraft, type MealDraftError } from '../domain/meal-draft'
import {
  MAX_SERVINGS,
  type HouseholdId,
  type Meal,
  type MealDetail,
  type MealId,
} from '../domain/types'

/**
 * Household Meals as rows of the synced board: `meal:<id>`. The Ingredients are
 * one list written with the Meal, as they were one RPC before; two Members
 * editing the same Meal at once keep whichever saved last. Another Member's
 * rows are read defensively, and one that does not parse is left out.
 */
const KIND = 'meal'

/** Unknown keys (an old row's `optional`) are stripped, not refused. */
const ingredientSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().max(20),
})

const rowSchema = z.object({
  name: z.string().min(1).max(120),
  servings: z.number().int().min(1).max(MAX_SERVINGS),
  // Parsed one by one: a single element that makes no sense drops alone,
  // rather than blanking the Meal for the next save to write [] over it.
  ingredients: z
    .array(z.unknown())
    .catch([])
    .transform((rows) =>
      rows.flatMap((row) => {
        const parsed = ingredientSchema.safeParse(row)
        return parsed.success ? [parsed.data] : []
      }),
    ),
})

const detailOf = (
  id: string,
  household: HouseholdId,
  row: z.infer<typeof rowSchema>,
): MealDetail => ({
  id: brand<string, 'MealId'>(id),
  householdId: household,
  name: row.name,
  servings: brand<number, 'Servings'>(row.servings),
  ingredientCount: row.ingredients.length,
  ingredients: row.ingredients.map((i) => ({
    ingredientId: brand<string, 'IngredientId'>(i.ingredientId),
    quantity: brand<number, 'Quantity'>(i.quantity),
    unit: i.unit,
  })),
})

const own = (data: Data, household: HouseholdId): readonly MealDetail[] =>
  data.list(KIND).flatMap(({ id, doc }) => {
    const row = rowSchema.safeParse(doc)
    return row.success ? [detailOf(id, household, row.data)] : []
  })

const withoutIngredients = (meal: MealDetail): Meal => ({
  id: meal.id,
  name: meal.name,
  servings: meal.servings,
  ingredientCount: meal.ingredientCount,
  ...(meal.householdId === undefined ? {} : { householdId: meal.householdId }),
})

/** Every Meal the Household can see: its own, then the Catalogue in its Locale. */
export const listMeals = (data: Data, household: HouseholdId, locale: Locale): readonly Meal[] => [
  ...own(data, household).map(withoutIngredients),
  ...catalogueMeals(locale).map(withoutIngredients),
]

export const getMeal = (
  data: Data,
  household: HouseholdId,
  locale: Locale,
  id: MealId,
): MealDetail | undefined =>
  catalogueMeals(locale).find((m) => m.id === id) ?? own(data, household).find((m) => m.id === id)

export type SaveMealError = MealDraftError | 'invalid-ingredient' | 'write-failed'

/** An Ingredient must be one we know, in a unit of its dimension (ADR 0013, point 9). */
const ingredientsFit = (draft: MealDraft): boolean => {
  const known = new Map(catalogueIngredients('en').map((i) => [String(i.id), i.dimension]))
  return draft.ingredients.every((row) => {
    const dimension = known.get(String(row.ingredientId))
    return (
      dimension !== undefined &&
      Number(row.quantity) > 0 &&
      dimensionOf(row.unit) === dimension &&
      unitsFor(dimension).includes(row.unit)
    )
  })
}

export const saveMeal = async (
  data: Data,
  random: Random,
  input: MealDraft & { readonly id?: MealId },
): Promise<Result<MealId, SaveMealError>> => {
  const validated = validateMealDraft(input)
  if (isErr(validated)) return err(validated.error)
  if (!ingredientsFit(validated.value)) return err('invalid-ingredient')
  const id = input.id ?? brand<string, 'MealId'>(newId(random))
  // A Catalogue Meal is never edited; the editor offers a copy instead (ADR 0005).
  if (id.startsWith('catalogue-')) return err('write-failed')
  try {
    await data.put(KIND, id, {
      name: validated.value.name,
      servings: Number(validated.value.servings),
      ingredients: validated.value.ingredients.map((i) => ({
        ingredientId: String(i.ingredientId),
        quantity: Number(i.quantity),
        unit: i.unit,
      })),
    })
    return ok(id)
  } catch {
    return err('write-failed')
  }
}

/**
 * Adding a Catalogue Meal copies it (ADR 0005). The family's copy is theirs to
 * edit, and a Catalogue edit never changes a planned week.
 */
export const copyCatalogueMeal = async (
  data: Data,
  random: Random,
  locale: Locale,
  sourceId: MealId,
): Promise<Result<MealId, 'write-failed'>> => {
  const source = catalogueMeals(locale).find((m) => m.id === sourceId)
  if (!source) return err('write-failed')
  const saved = await saveMeal(data, random, {
    name: source.name,
    servings: source.servings,
    ingredients: source.ingredients,
  })
  return isErr(saved) ? err('write-failed') : saved
}

/**
 * The row goes; whatever was planned from it is hidden by the planning layer,
 * which no longer finds the Meal. The caller must have said so first.
 */
export const deleteMeal = async (data: Data, id: MealId): Promise<Result<void, 'write-failed'>> => {
  try {
    await data.remove(KIND, id)
    return ok(undefined)
  } catch {
    return err('write-failed')
  }
}

/**
 * Every Meal by id, with its Ingredients, in one pass: Household Meals and the
 * Catalogue alike. A Meal that is gone is simply not in it, which is how what
 * was planned from it drops off the board.
 */
export const mealIndex = (
  data: Data,
  household: HouseholdId,
  locale: Locale,
): ReadonlyMap<string, MealDetail> =>
  new Map([...catalogueMeals(locale), ...own(data, household)].map((m) => [String(m.id), m]))
