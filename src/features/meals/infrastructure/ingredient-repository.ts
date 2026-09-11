import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { Locale } from '@/shared/i18n'
import { localisedNameSchema, resolveLocalisedName } from '@/shared/i18n/localised-name'
import type { Ingredient } from '../domain/types'

const rowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  category: z.string(),
  dimension: z.enum(['mass', 'volume', 'count']),
  base_unit: z.string(),
  ingredient_name: localisedNameSchema,
})

export type LoadIngredientsError = 'invalid-row'

/**
 * Resolves each Ingredient's display name for the Household's Locale, falling
 * back to any name it has. A Household-created Ingredient may only have one.
 */
export const loadIngredients = async (
  client: AppSupabaseClient,
  locale: Locale,
): Promise<Result<readonly Ingredient[], LoadIngredientsError>> => {
  const { data } = await client
    .from('ingredient')
    .select('id,slug,category,dimension,base_unit,ingredient_name(locale,name)')

  const rows = z.array(rowSchema).safeParse(data ?? [])
  if (!rows.success) return err('invalid-row')

  return ok(
    rows.data
      .map((r) => ({
        id: brand<string, 'IngredientId'>(r.id),
        slug: brand<string, 'IngredientSlug'>(r.slug),
        name: resolveLocalisedName(r.ingredient_name, locale, r.slug),
        category: r.category,
        dimension: r.dimension,
        baseUnit: r.base_unit,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}
