import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '../src/shared/db/database.types'
import ingredientData from '../data/catalogue/ingredients.json'
import mealData from '../data/catalogue/meals.json'
import { ingredientSchema, mealSchema, validateCatalogue } from './catalogue-schema'

const env = z
  .object({
    EXPO_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  })
  .parse(process.env)

const admin = createClient<Database>(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

const sync = async (): Promise<void> => {
  const ingredients = z.array(ingredientSchema).parse(ingredientData)
  const meals = z.array(mealSchema).parse(mealData)

  const problems = validateCatalogue(ingredients, meals)
  if (problems.length > 0) {
    process.stderr.write(`Catalogue is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`)
    process.exit(1)
  }

  // Idempotent: the Catalogue is reference data, so a re-run is a replace, not
  // an append. Household Meals and Ingredients are untouched.
  await admin.from('meal').delete().is('household_id', null)
  await admin.from('ingredient').delete().is('household_id', null).neq('id', NIL_UUID)

  const slugToId = new Map<string, string>()
  for (const ingredient of ingredients) {
    const { data, error } = await admin
      .from('ingredient')
      .insert({
        household_id: null,
        slug: ingredient.slug,
        category: ingredient.category,
        dimension: ingredient.dimension,
        base_unit: ingredient.baseUnit,
      })
      .select('id')
      .single()
    if (error !== null) throw new Error(`Ingredient ${ingredient.slug}: ${error.message}`)

    slugToId.set(ingredient.slug, data.id)

    const { error: nameError } = await admin.from('ingredient_name').insert([
      { ingredient_id: data.id, locale: 'fi', name: ingredient.names.fi },
      { ingredient_id: data.id, locale: 'en', name: ingredient.names.en },
    ])
    if (nameError !== null)
      throw new Error(`Ingredient names ${ingredient.slug}: ${nameError.message}`)
  }

  // One Meal row per Locale: a Catalogue Meal carries its name in the file, and
  // a Household copies the row matching its own Locale (ADR 0009).
  for (const meal of meals) {
    for (const locale of ['fi', 'en'] as const) {
      const { data, error } = await admin
        .from('meal')
        .insert({ household_id: null, name: meal.names[locale], servings: meal.servings })
        .select('id')
        .single()
      if (error !== null) throw new Error(`Meal ${meal.names.en}: ${error.message}`)

      if (meal.ingredients.length === 0) continue

      const { error: rowError } = await admin.from('meal_ingredient').insert(
        meal.ingredients.map((row) => {
          const ingredientId = slugToId.get(row.slug)
          if (ingredientId === undefined) throw new Error(`Unknown slug ${row.slug}`)
          return {
            meal_id: data.id,
            ingredient_id: ingredientId,
            quantity: row.quantity,
            unit: row.unit,
          }
        }),
      )
      if (rowError !== null)
        throw new Error(`Meal Ingredients ${meal.names.en}: ${rowError.message}`)
    }
  }

  process.stdout.write(
    `Synced ${String(ingredients.length)} Ingredients and ${String(meals.length)} Catalogue Meals in 2 Locales\n`,
  )
}

void sync()
