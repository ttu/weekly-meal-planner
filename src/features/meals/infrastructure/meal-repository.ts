import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { Meal } from '../domain/types'

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
