import { brand } from '@/shared/types/brand'
import { isErr, type Result } from '@/shared/types/result'
import type { Locale } from '@/shared/i18n'
import {
  createInviteLink,
  joinFromLink,
  recoveryLink,
  startBoard,
  type SlotKey,
} from '@/features/household'
import { saveMeal, type IngredientId, type MealId, type Servings } from '@/features/meals'
import {
  addLeftover,
  addToBacklog,
  currentWeekStart,
  planMeal,
  weekDates,
} from '@/features/planning'
import { addExtra, makeStaple, markRunningLow } from '@/features/shopping'
import { dataOf, type Engine, type Identity, type KeyValue, type SyncDeps } from '@/features/sync'

/**
 * A development-only board with something on it: three Members, a planned
 * week, wishes on the Backlog, a Household Meal, Staples and Extras. Built
 * through the same application functions the screens use, so it is always a
 * board the app can read. Never shipped as a feature: the start route offers
 * it only when `__DEV__` is true.
 */

export type DemoLink = { readonly name: string; readonly url: string }

const meal = (name: string): MealId =>
  brand<string, 'MealId'>(
    `catalogue-${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`,
  )
const slot = (key: string): SlotKey => brand<string, 'SlotKey'>(key)
const servings = (n: number): Servings => brand<number, 'Servings'>(n)
const ingredient = (slug: string): IngredientId => brand<string, 'IngredientId'>(slug)

// The other Members' devices exist only while the seed runs.
const memoryKv = (): KeyValue => {
  const map = new Map<string, string>()
  return {
    get: (k) => Promise.resolve(map.get(k)),
    set: (k, v) => {
      map.set(k, v)
      return Promise.resolve()
    },
  }
}

const must = async <T>(step: string, result: Promise<Result<T, unknown>>): Promise<T> => {
  const settled = await result
  if (isErr(settled)) throw new Error(`demo board: ${step} failed (${String(settled.error)})`)
  return settled.value
}

const joinAs = async (deps: SyncDeps, admin: Engine, origin: string, name: string) => {
  const link = await must(`inviting ${name}`, createInviteLink(admin, origin))
  const device = { ...deps, storage: memoryKv(), vault: memoryKv() }
  return (await must(`joining as ${name}`, joinFromLink(device, link, name))).engine
}

export const seedDemoBoard = async (
  deps: SyncDeps,
  me: Identity,
  origin: string,
  locale: Locale,
): Promise<{ readonly engine: Engine; readonly links: readonly DemoLink[] }> => {
  const aino = await must(
    'starting the board',
    startBoard(deps, me, { boardName: 'Koivisto', displayName: 'Aino', locale }),
  )
  const sanni = await joinAs(deps, aino, origin, 'Sanni')
  const mikko = await joinAs(deps, aino, origin, 'Mikko')

  const week = currentWeekStart(deps.clock)
  const [mon, tue, wed, thu, fri] = weekDates(week)
  const now = deps.clock.now().getTime()
  const data = dataOf(aino)
  const ainoId = aino.view().me

  const wish = (engine: Engine, name: string) =>
    must(
      `wishing for ${name}`,
      addToBacklog(dataOf(engine), deps.random, now, {
        weekStart: week,
        mealId: meal(name),
        addedBy: engine.view().me,
      }),
    )
  await wish(sanni, 'Tacos')
  await wish(mikko, 'Pizza')
  await wish(aino, 'Mushroom risotto')

  const plan = (date: string | undefined, slotKey: string, name: string, cooked: number) =>
    must(
      `planning ${name}`,
      planMeal(data, deps.random, {
        mealId: meal(name),
        date: date ?? week,
        slotKey: slot(slotKey),
        servingsCooked: servings(cooked),
        addedBy: ainoId,
      }),
    )
  await plan(mon, 'dinner', 'Spaghetti bolognese', 4)
  await plan(tue, 'dinner', 'Salmon soup', 4)
  await plan(wed, 'lunch', 'Omelette', 2)
  const curry = await plan(thu, 'dinner', 'Chicken curry', 6)
  if (curry !== undefined) {
    await must(
      'adding a Leftover',
      addLeftover(data, deps.random, {
        cookEventId: curry,
        date: fri ?? week,
        slotKey: slot('lunch'),
      }),
    )
  }

  await must(
    'saving a Household Meal',
    saveMeal(data, deps.random, {
      name: locale === 'fi' ? 'Mummon lihakeitto' : "Grandma's meat soup",
      servings: servings(6),
      ingredients: [
        { ingredientId: ingredient('minced-beef'), quantity: brand(500), unit: 'g' },
        { ingredientId: ingredient('potato'), quantity: brand(800), unit: 'g' },
        { ingredientId: ingredient('carrot'), quantity: brand(3), unit: 'pcs' },
      ],
    }),
  )

  for (const staple of ['salt', 'olive-oil', 'black-pepper'])
    await must(`keeping ${staple} in`, makeStaple(data, ingredient(staple)))
  await must('running low on cumin', markRunningLow(data, week, ingredient('ground-cumin')))
  await must('adding coffee', addExtra(data, deps.random, now, week, 'Coffee'))
  await must('adding dish soap', addExtra(data, deps.random, now, week, 'Dish soap'))

  // Everyone's writes reach the relay, then the admin's device reads them back.
  await sanni.sync()
  await mikko.sync()
  await aino.sync()

  const links = [
    { name: 'Aino', engine: aino },
    { name: 'Sanni', engine: sanni },
    { name: 'Mikko', engine: mikko },
  ].flatMap(({ name, engine }) => {
    const url = recoveryLink(engine, origin)
    return url === undefined ? [] : [{ name, url }]
  })
  return { engine: aino, links }
}
