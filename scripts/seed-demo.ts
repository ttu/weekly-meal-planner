import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '../src/shared/db/database.types'

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
const DEMO_PASSWORD = 'meal-planner-demo'

const MEMBERS = [
  { email: 'aino@example.test', displayName: 'Aino', colour: '#5F7355', role: 'owner' },
  { email: 'sanni@example.test', displayName: 'Sanni', colour: '#C05A38', role: 'member' },
  { email: 'mikko@example.test', displayName: 'Mikko', colour: '#4A6670', role: 'member' },
]

/**
 * Real auth users, so the demo Household can actually be signed into. Local
 * only: these credentials exist on a developer machine and nowhere else.
 */
const seedAuthUsers = async (): Promise<Map<string, string>> => {
  const { data: existing, error: listError } = await admin.auth.admin.listUsers()
  if (listError !== null) fail('List auth users', listError.message)
  for (const user of existing.users) await admin.auth.admin.deleteUser(user.id)

  const emailToId = new Map<string, string>()
  for (const member of MEMBERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: member.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error !== null) fail(`Auth user ${member.email}`, error.message)
    if (data.user === null) throw new Error(`Auth user ${member.email} came back empty`)
    emailToId.set(member.email, data.user.id)
  }
  return emailToId
}

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
  // The Ingredients are the Catalogue's: `catalogue:sync` owns them, so the demo
  // Household's Meals point at the same rows every Household sees.
  const { data: catalogueIngredients, error: ingredientError } = await admin
    .from('ingredient')
    .select('id,slug')
    .is('household_id', null)
  if (ingredientError !== null) fail('Catalogue Ingredients', ingredientError.message)

  const slugToId = new Map((catalogueIngredients ?? []).map((i) => [i.slug, i.id]))
  if (slugToId.size === 0) fail('Catalogue Ingredients', 'none found — run catalogue:sync first')

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

const seedWeek = async (householdId: string, userId: (email: string) => string): Promise<void> => {
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
        added_by: userId('mikko@example.test'),
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Chili con carne'),
        date: weekStart,
        slot_key: 'dinner',
        servings_cooked: 6,
        added_by: userId('aino@example.test'),
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Uunilohi ja perunamuusi'),
        date: addDays(weekStart, 1),
        slot_key: 'dinner',
        servings_cooked: 3,
        added_by: userId('aino@example.test'),
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Tacos'),
        date: addDays(weekStart, 1),
        slot_key: 'dinner',
        servings_cooked: 2,
        added_by: userId('sanni@example.test'),
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

  const { error: backlogError } = await admin.from('backlog_item').insert([
    { week_plan_id: weekPlanId, meal_id: mealId('Tacos'), added_by: userId('sanni@example.test') },
    {
      week_plan_id: weekPlanId,
      meal_id: mealId('Munavoileivät'),
      added_by: userId('mikko@example.test'),
    },
  ])
  if (backlogError !== null) fail('Backlog Items', backlogError.message)

  // Staples so the Cupboard Check has something to show. Cumin is the classic
  // case: used by a Meal this week, but nobody buys it weekly.
  const { data: stapleIngredients } = await admin
    .from('ingredient')
    .select('id,slug')
    .in('slug', ['ground-cumin', 'potato'])

  if (stapleIngredients !== null) {
    const { error: stapleError } = await admin.from('household_staple').insert(
      stapleIngredients.map((i) => ({
        household_id: householdId,
        ingredient_id: i.id,
        running_low: false,
      })),
    )
    if (stapleError !== null) fail('Staples', stapleError.message)
  }

  process.stdout.write(`Seeded Week Plan for ${weekStart} with 2 Backlog Items and 2 Staples\n`)
}

const seed = async (): Promise<void> => {
  // Cascades clear members, meals and meal_ingredient rows.
  await admin.from('household').delete().neq('id', NIL_UUID)

  const { data: household, error } = await admin
    .from('household')
    .insert({ name: 'Koivisto', locale: 'fi' })
    .select('id')
    .single()
  if (error !== null) fail('Household', error.message)

  const householdId = (household as { id: string }).id

  const emailToId = await seedAuthUsers()
  const userId = (email: string): string => {
    const id = emailToId.get(email)
    if (id === undefined) throw new Error(`Seed failed to create auth user ${email}`)
    return id
  }

  const { error: memberError } = await admin.from('household_member').insert(
    MEMBERS.map((m) => ({
      household_id: householdId,
      user_id: userId(m.email),
      role: m.role,
      display_name: m.displayName,
      colour: m.colour,
    })),
  )
  if (memberError !== null) fail('Members', memberError.message)

  process.stdout.write(`Seeded Household ${householdId} with ${String(MEMBERS.length)} Members\n`)

  await seedMeals(householdId)
  await seedWeek(householdId, userId)

  const logins = MEMBERS.map((m) => `  ${m.email} / ${DEMO_PASSWORD}`).join('\n')
  process.stdout.write(`\nSign in as any of:\n${logins}\n`)
}

void seed()
