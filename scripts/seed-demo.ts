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

const DAY_MS = 86_400_000

/** The demo week is always the current week; a fixture pinned to a past date
 *  shows an empty board later and wastes an afternoon. */
const mondayOfThisWeek = (): string => {
  const now = new Date()
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const daysSinceMonday = (new Date(utcMidnight).getUTCDay() + 6) % 7
  return new Date(utcMidnight - daysSinceMonday * DAY_MS).toISOString().slice(0, 10)
}

const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)

const seedWeek = async (householdId: string): Promise<void> => {
  const weekStart = mondayOfThisWeek()

  const { data: plan, error } = await admin
    .from('week_plan')
    .insert({ household_id: householdId, week_start: weekStart })
    .select('id')
    .single()
  if (error !== null) fail('Week Plan', error.message)

  const weekPlanId = (plan as { id: string }).id

  const { data: meals } = await admin.from('meal').select('id,name').eq('household_id', householdId)

  const byName = new Map((meals ?? []).map((m) => [m.name, m.id]))
  const mealId = (name: string): string => {
    const id = byName.get(name)
    if (id === undefined) throw new Error(`Seed expects a Meal named ${name}`)
    return id
  }

  // Covers every board state: a normal day, two Meals in one Slot, a Leftover,
  // and empty Slots.
  const { data: events, error: eventError } = await admin
    .from('cook_event')
    .insert([
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Munavoileivät'),
        date: weekStart,
        slot_key: 'lunch',
        servings_cooked: 2,
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Chili con carne'),
        date: weekStart,
        slot_key: 'dinner',
        servings_cooked: 6,
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Uunilohi ja perunamuusi'),
        date: addDays(weekStart, 1),
        slot_key: 'dinner',
        servings_cooked: 3,
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Tacos'),
        date: addDays(weekStart, 1),
        slot_key: 'dinner',
        servings_cooked: 2,
      },
    ])
    .select('id,meal_id')
  if (eventError !== null) fail('Cook Events', eventError.message)

  const chiliEvent = (events ?? []).find((e) => e.meal_id === mealId('Chili con carne'))
  if (chiliEvent === undefined) throw new Error('Seed failed to create the Chili Cook Event')

  const { error: leftoverError } = await admin.from('leftover').insert({
    cook_event_id: chiliEvent.id,
    date: addDays(weekStart, 2),
    slot_key: 'lunch',
  })
  if (leftoverError !== null) fail('Leftover', leftoverError.message)

  process.stdout.write(`Seeded Week Plan for ${weekStart}\n`)
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
  await seedWeek(householdId)
}

void seed()
