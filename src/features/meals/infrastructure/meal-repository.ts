import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { Locale } from '@/shared/i18n'
import type { AppSupabaseClient } from '@/features/household'
import { isStoredPhoto } from '../domain/photo'
import { signMealPhotos } from './meal-photo-repository'
import type { IngredientId, Meal, MealId, Quantity } from '../domain/types'

const rowSchema = z.object({
  id: z.uuid(),
  household_id: z.uuid().nullable(),
  name: z.string(),
  servings: z.number().int(),
  photo_url: z.string().nullable(),
  meal_ingredient: z.array(z.object({ count: z.number() })),
})

/**
 * What the card should display. A stored path becomes a signed URL; an
 * absolute URL is already one. A path that could not be signed is dropped, and
 * the card falls back to its serif initial.
 */
const photoOf = (
  photoUrl: string | null,
  signed: ReadonlyMap<string, string>,
): { photoUrl?: string } => {
  if (photoUrl === null) return {}
  if (!isStoredPhoto(photoUrl)) return { photoUrl }
  const url = signed.get(photoUrl)
  return url === undefined ? {} : { photoUrl: url }
}

export type LoadMealsError = 'query-failed' | 'invalid-row'

/**
 * Every Meal the Household can see: its own, plus the Catalogue in its own
 * Locale. A Catalogue Meal exists once per Locale, so without the filter the
 * library lists each of them twice — in Finnish and in English.
 */
export const loadMeals = async (
  client: AppSupabaseClient,
  locale: Locale,
): Promise<Result<readonly Meal[], LoadMealsError>> => {
  const { data, error } = await client
    .from('meal')
    .select('id,household_id,name,servings,photo_url,meal_ingredient(count)')
    .or(`locale.is.null,locale.eq.${locale}`)
  if (error !== null) return err('query-failed')

  const rows = z.array(rowSchema).safeParse(data)
  if (!rows.success) return err('invalid-row')

  // One round trip for every photo on the screen, not one per card.
  const signed = await signMealPhotos(
    client,
    rows.data.flatMap((r) => (r.photo_url === null ? [] : [r.photo_url])),
  )

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
      ...photoOf(r.photo_url, signed),
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
  /** The object path behind `photoUrl`, which is a signed URL and cannot be
   *  turned back into one. The editor needs it to replace or delete the file. */
  readonly photoPath?: string
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

  const signed = await signMealPhotos(
    client,
    row.data.photo_url === null ? [] : [row.data.photo_url],
  )

  return ok({
    id: brand<string, 'MealId'>(row.data.id),
    ...(row.data.household_id === null
      ? {}
      : { householdId: brand<string, 'HouseholdId'>(row.data.household_id) }),
    name: row.data.name,
    servings: brand<number, 'Servings'>(row.data.servings),
    ...photoOf(row.data.photo_url, signed),
    ...(row.data.photo_url !== null && isStoredPhoto(row.data.photo_url)
      ? { photoPath: row.data.photo_url }
      : {}),
    ingredientCount: row.data.meal_ingredient.length,
    ingredients: row.data.meal_ingredient.map((i) => ({
      ingredientId: brand<string, 'IngredientId'>(i.ingredient_id),
      quantity: brand<number, 'Quantity'>(i.quantity),
      unit: i.unit,
      optional: i.optional,
    })),
  })
}
