import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import type { Locale } from '@/shared/i18n'
import ingredientsJson from '../../../../data/catalogue/ingredients.json'
import mealsJson from '../../../../data/catalogue/meals.json'
import type { Ingredient, MealDetail } from './types'

/**
 * The Catalogue ships with the app (ADR 0013): reference data, the same for
 * every Household, never synced. An Ingredient's identity is its slug, and a
 * Catalogue Meal's id is derived from its English name, so both are stable
 * between releases and between devices.
 */
const localised = z.object({ fi: z.string(), en: z.string() })
const ingredientRows = z.array(
  z.object({
    slug: z.string(),
    category: z.string(),
    dimension: z.enum(['mass', 'volume', 'count']),
    baseUnit: z.string(),
    names: localised,
  }),
)
const mealRows = z.array(
  z.object({
    names: localised,
    servings: z.number().int(),
    ingredients: z.array(z.object({ slug: z.string(), quantity: z.number(), unit: z.string() })),
  }),
)

export const catalogueIngredients = (locale: Locale): readonly Ingredient[] =>
  ingredientRows
    .parse(ingredientsJson)
    .map((r) => ({
      id: brand<string, 'IngredientId'>(r.slug),
      slug: brand<string, 'IngredientSlug'>(r.slug),
      name: r.names[locale],
      category: r.category,
      dimension: r.dimension,
      baseUnit: r.baseUnit,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

const idOf = (englishName: string): string =>
  `catalogue-${englishName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`

export const catalogueMeals = (locale: Locale): readonly MealDetail[] =>
  mealRows.parse(mealsJson).map((r) => ({
    id: brand<string, 'MealId'>(idOf(r.names.en)),
    name: r.names[locale],
    servings: brand<number, 'Servings'>(r.servings),
    ingredientCount: r.ingredients.length,
    ingredients: r.ingredients.map((i) => ({
      ingredientId: brand<string, 'IngredientId'>(i.slug),
      quantity: brand<number, 'Quantity'>(i.quantity),
      unit: i.unit,
    })),
  }))
