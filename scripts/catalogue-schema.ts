import { z } from 'zod'

const localised = z.object({ fi: z.string().min(1), en: z.string().min(1) })

export const ingredientSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lower-case and hyphenated'),
  category: z.string().min(1),
  dimension: z.enum(['mass', 'volume', 'count']),
  baseUnit: z.string().min(1),
  names: localised,
})

export const mealSchema = z.object({
  names: localised,
  servings: z.number().int().min(1).max(50),
  ingredients: z.array(
    z.object({
      slug: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    }),
  ),
})

export type CatalogueIngredient = z.infer<typeof ingredientSchema>
export type CatalogueMeal = z.infer<typeof mealSchema>

const UNITS: Record<string, readonly string[]> = {
  mass: ['g', 'kg'],
  volume: ['ml', 'dl', 'l'],
  count: ['pcs', 'tin', 'pack', 'bunch'],
}

/**
 * Validates the reference data as a whole, not row by row: a Meal naming an
 * Ingredient slug that does not exist, or measuring one in a unit from another
 * dimension, is invalid however well-formed each file is on its own.
 *
 * Both Locales are required. A Catalogue Meal missing one would be invisible to
 * half the app (ADR 0009).
 */
export const validateCatalogue = (
  ingredients: readonly CatalogueIngredient[],
  meals: readonly CatalogueMeal[],
): readonly string[] => {
  const problems: string[] = []

  const bySlug = new Map(ingredients.map((i) => [i.slug, i]))
  if (bySlug.size !== ingredients.length) problems.push('Duplicate Ingredient slug')

  for (const ingredient of ingredients) {
    const units = UNITS[ingredient.dimension]
    if (units !== undefined && !units.includes(ingredient.baseUnit)) {
      problems.push(
        `${ingredient.slug}: base unit ${ingredient.baseUnit} is not a ${ingredient.dimension} unit`,
      )
    }
  }

  const names = new Set<string>()
  for (const meal of meals) {
    if (names.has(meal.names.fi)) problems.push(`Duplicate Meal name: ${meal.names.fi}`)
    names.add(meal.names.fi)

    for (const row of meal.ingredients) {
      const ingredient = bySlug.get(row.slug)
      if (ingredient === undefined) {
        problems.push(`${meal.names.en}: unknown Ingredient slug "${row.slug}"`)
        continue
      }
      const units = UNITS[ingredient.dimension]
      if (units !== undefined && !units.includes(row.unit)) {
        problems.push(
          `${meal.names.en}: ${row.slug} measured in ${row.unit}, which is not a ${ingredient.dimension} unit`,
        )
      }
    }
  }

  return problems
}
