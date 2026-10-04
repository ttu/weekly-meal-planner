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

/** A unit belongs to a dimension, or the dimension is one we do not police. */
const unitFits = (dimension: string, unit: string): boolean => {
  const units = UNITS[dimension]
  return units === undefined || units.includes(unit)
}

const baseUnitProblems = (ingredients: readonly CatalogueIngredient[]): readonly string[] =>
  ingredients.flatMap((ingredient) =>
    unitFits(ingredient.dimension, ingredient.baseUnit)
      ? []
      : [
          `${ingredient.slug}: base unit ${ingredient.baseUnit} is not a ${ingredient.dimension} unit`,
        ],
  )

const duplicateNameProblems = (meals: readonly CatalogueMeal[]): readonly string[] => {
  const seen = new Set<string>()
  const problems: string[] = []
  for (const meal of meals) {
    if (seen.has(meal.names.fi)) problems.push(`Duplicate Meal name: ${meal.names.fi}`)
    seen.add(meal.names.fi)
  }
  return problems
}

const mealIngredientProblems = (
  meal: CatalogueMeal,
  bySlug: ReadonlyMap<string, CatalogueIngredient>,
): readonly string[] =>
  meal.ingredients.flatMap((row) => {
    const ingredient = bySlug.get(row.slug)
    if (ingredient === undefined) {
      return [`${meal.names.en}: unknown Ingredient slug "${row.slug}"`]
    }
    if (unitFits(ingredient.dimension, row.unit)) return []
    return [
      `${meal.names.en}: ${row.slug} measured in ${row.unit}, which is not a ${ingredient.dimension} unit`,
    ]
  })

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
  const bySlug = new Map(ingredients.map((i) => [i.slug, i]))

  return [
    ...(bySlug.size === ingredients.length ? [] : ['Duplicate Ingredient slug']),
    ...baseUnitProblems(ingredients),
    ...duplicateNameProblems(meals),
    ...meals.flatMap((meal) => mealIngredientProblems(meal, bySlug)),
  ]
}
