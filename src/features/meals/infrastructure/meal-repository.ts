import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { IngredientId, Meal, MealId, Quantity } from '../domain/types'

const rowSchema = z.object({
  id: z.uuid(),
  household_id: z.uuid().nullable(),
  name: z.string(),
  servings: z.number().int(),
  photo_url: z.string().nullable(),
  meal_ingredient: z.array(z.object({ count: z.number() })),
})

export type LoadMealsError = 'invalid-row'

export const loadMeals = async (
  client: AppSupabaseClient,
): Promise<Result<readonly Meal[], LoadMealsError>> => {
  const { data } = await client
    .from('meal')
    .select('id,household_id,name,servings,photo_url,meal_ingredient(count)')

  const rows = z.array(rowSchema).safeParse(data ?? [])
  if (!rows.success) return err('invalid-row')

  // null at the edge becomes undefined inside; the domain never carries null.
  return ok(
    rows.data.map((r) => ({
      id: brand<string, 'MealId'>(r.id),
      ...(r.household_id === null
        ? {}
        : { householdId: brand<string, 'HouseholdId'>(r.household_id) }),
      name: r.name,
      servings: brand<number, 'Servings'>(r.servings),
      ingredientCount: r.meal_ingredient[0]?.count ?? 0,
      ...(r.photo_url === null ? {} : { photoUrl: r.photo_url }),
    })),
  )
}

const detailSchema = z.object({
  id: z.uuid(),
  household_id: z.uuid().nullable(),
  name: z.string(),
  servings: z.number().int(),
  photo_url: z.string().nullable(),
  meal_ingredient: z.array(
    z.object({
      ingredient_id: z.uuid(),
      quantity: z.number(),
      unit: z.string(),
      optional: z.boolean(),
    }),
  ),
})

export type MealDetail = Meal & {
  readonly ingredients: readonly {
    readonly ingredientId: IngredientId
    readonly quantity: Quantity
    readonly unit: string
    readonly optional: boolean
  }[]
}

export type LoadMealError = 'not-found' | 'invalid-row'

export const loadMeal = async (
  client: AppSupabaseClient,
  id: MealId,
): Promise<Result<MealDetail, LoadMealError>> => {
  const { data } = await client
    .from('meal')
    .select(
      'id,household_id,name,servings,photo_url,meal_ingredient(ingredient_id,quantity,unit,optional)',
    )
    .eq('id', id)
    .maybeSingle()

  if (data === null) return err('not-found')

  const row = detailSchema.safeParse(data)
  if (!row.success) return err('invalid-row')

  return ok({
    id: brand<string, 'MealId'>(row.data.id),
    ...(row.data.household_id === null
      ? {}
      : { householdId: brand<string, 'HouseholdId'>(row.data.household_id) }),
    name: row.data.name,
    servings: brand<number, 'Servings'>(row.data.servings),
    ...(row.data.photo_url === null ? {} : { photoUrl: row.data.photo_url }),
    ingredientCount: row.data.meal_ingredient.length,
    ingredients: row.data.meal_ingredient.map((i) => ({
      ingredientId: brand<string, 'IngredientId'>(i.ingredient_id),
      quantity: brand<number, 'Quantity'>(i.quantity),
      unit: i.unit,
      optional: i.optional,
    })),
  })
}
