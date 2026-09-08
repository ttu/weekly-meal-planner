import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '../src/shared/db/database.types'
import ingredients from '../data/ingredients.json'

// Validated at the edge like every other external input. The service role key
// is deliberately not EXPO_PUBLIC_: it must never reach the app bundle.
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

/**
 * Member colours exclude backlog amber, which means "wanted but unplanned" and
 * must not be diluted by appearing on a person (docs/07-design-system.md).
 */
const MEMBERS = [
  {
    userId: '00000000-0000-0000-0000-000000000001',
    displayName: 'Aino',
    colour: '#5F7355',
    role: 'owner',
  },
  {
    userId: '00000000-0000-0000-0000-000000000002',
    displayName: 'Sanni',
    colour: '#C05A38',
    role: 'member',
  },
  {
    userId: '00000000-0000-0000-0000-000000000003',
    displayName: 'Mikko',
    colour: '#4A6670',
    role: 'member',
  },
]

const fail = (what: string, message: string): never => {
  throw new Error(`${what}: ${message}`)
}

const MEALS = [
  {
    name: 'Chili con carne',
    servings: 4,
    ingredients: [
      { slug: 'onion', quantity: 2, unit: 'pcs' },
      { slug: 'minced-beef', quantity: 400, unit: 'g' },
      { slug: 'tinned-tomatoes', quantity: 2, unit: 'tin' },
      { slug: 'kidney-beans', quantity: 2, unit: 'tin' },
      { slug: 'ground-cumin', quantity: 5, unit: 'g' },
    ],
  },
  {
    name: 'Uunilohi ja perunamuusi',
    servings: 4,
    ingredients: [
      { slug: 'salmon-fillet', quantity: 600, unit: 'g' },
      { slug: 'potato', quantity: 1000, unit: 'g' },
    ],
  },
  // Two Meals deliberately carry no Ingredients, so the incomplete-Meal line in
  // plan 04 has real data to render against.
  { name: 'Munavoileivät', servings: 2, ingredients: [] },
  { name: 'Tacos', servings: 4, ingredients: [] },
]

const seedMeals = async (householdId: string): Promise<void> => {
  const slugToId = new Map<string, string>()

  for (const ing of ingredients) {
    const { data, error } = await admin
      .from('ingredient')
      .insert({
        household_id: null,
        slug: ing.slug,
        category: ing.category,
        dimension: ing.dimension,
        base_unit: ing.baseUnit,
      })
      .select('id')
      .single()
    if (error !== null) fail(`Ingredient ${ing.slug}`, error.message)

    const ingredientId = (data as { id: string }).id
    slugToId.set(ing.slug, ingredientId)

    const { error: nameError } = await admin.from('ingredient_name').insert(
      Object.entries(ing.names).map(([locale, name]) => ({
        ingredient_id: ingredientId,
        locale,
        name,
      })),
    )
    if (nameError !== null) fail(`Ingredient names ${ing.slug}`, nameError.message)
  }

  for (const meal of MEALS) {
    const { data, error } = await admin
      .from('meal')
      .insert({ household_id: householdId, name: meal.name, servings: meal.servings })
      .select('id')
      .single()
    if (error !== null) fail(`Meal ${meal.name}`, error.message)

    if (meal.ingredients.length === 0) continue

    const mealId = (data as { id: string }).id
    const { error: miError } = await admin.from('meal_ingredient').insert(
      meal.ingredients.map((mi) => {
        const ingredientId = slugToId.get(mi.slug)
        // Thrown rather than routed through fail(): TypeScript only narrows on
        // a never-returning call when the callee has an explicit annotation at
        // the declaration site, which an arrow const does not give us.
        if (ingredientId === undefined) throw new Error(`Unknown Ingredient slug: ${mi.slug}`)
        return {
          meal_id: mealId,
          ingredient_id: ingredientId,
          quantity: mi.quantity,
          unit: mi.unit,
        }
      }),
    )
    if (miError !== null) fail(`Meal Ingredients ${meal.name}`, miError.message)
  }

  process.stdout.write(`Seeded ${String(MEALS.length)} Meals\n`)
}

const seed = async (): Promise<void> => {
  // Cascades clear members, meals and meal_ingredient rows.
  await admin.from('household').delete().neq('id', NIL_UUID)
  await admin.from('ingredient').delete().is('household_id', null)

  const { data: household, error } = await admin
    .from('household')
    .insert({ name: 'Koivisto', locale: 'fi' })
    .select('id')
    .single()
  if (error !== null) fail('Household', error.message)

  const householdId = (household as { id: string }).id

  const { error: memberError } = await admin.from('household_member').insert(
    MEMBERS.map((m) => ({
      household_id: householdId,
      user_id: m.userId,
      role: m.role,
      display_name: m.displayName,
      colour: m.colour,
    })),
  )
  if (memberError !== null) fail('Members', memberError.message)

  process.stdout.write(`Seeded Household ${householdId} with ${String(MEMBERS.length)} Members\n`)

  await seedMeals(householdId)
}

void seed()
