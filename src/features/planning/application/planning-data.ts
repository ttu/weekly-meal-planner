import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { err, ok, type Result } from '@/shared/types/result'
import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import { newId, type Data, type Random } from '@/features/sync'
import { weekStartOfDate } from '../domain/week'
import type {
  BacklogItem,
  BacklogItemId,
  CookEvent,
  CookEventId,
  Leftover,
  LeftoverId,
  WeekStart,
} from '../domain/types'

/**
 * Planning as rows of the synced board (ADR 0013), keyed by the Week's Monday:
 * there is no Week Plan row, so nothing has to be made before the first Meal.
 *
 *   backlog:<id>   week, mealId, addedBy, createdAt
 *   cook:<id>      week, mealId, date, slot, servings, addedBy?, fromBacklog?
 *   leftover:<id>  cook, date, slot
 *
 * Planning a Backlog Item gives the Cook Event the Item's own id, so two Members
 * planning it at once write the same row and converge on one Cook Event, which
 * is what the old `plan_meal` guaranteed by deleting the Item first. Unplanning
 * brings the Item back under that id with its author intact. A Meal that no
 * longer exists, or a Cook Event that is gone, hides what hangs off it instead
 * of leaving a card for nothing.
 */
export type PlanningError = 'write-failed' | 'limit-reached'

/** The caps the database enforced, now enforced where the write is made. */
const MAX_PER_WEEK = 100
const MAX_LEFTOVERS_PER_COOK_EVENT = 20

const backlogRow = z.object({
  week: z.string(),
  mealId: z.string(),
  addedBy: z.string(),
  createdAt: z.number().catch(0),
})
const cookRow = z.object({
  week: z.string(),
  mealId: z.string(),
  date: z.string(),
  slot: z.string(),
  servings: z.number().int().min(1).max(50),
  addedBy: z.string().optional(),
  fromBacklog: z.string().optional(),
})
const leftoverRow = z.object({ cook: z.string(), date: z.string(), slot: z.string() })

export type MemberLook = { readonly name: string; readonly colour: string }
export type MealLook = { readonly name: string; readonly servings: Servings }

export type WeekContents = {
  readonly cookEvents: readonly CookEvent[]
  readonly leftovers: readonly Leftover[]
  readonly backlog: readonly BacklogItem[]
}

/** Everything the board shows for one week. Hostile or half-written rows are left out. */
export const readWeek = (
  data: Data,
  weekStart: WeekStart,
  meals: ReadonlyMap<string, MealLook>,
  members: ReadonlyMap<string, MemberLook>,
): WeekContents => {
  const who = (key: string | undefined): MemberLook =>
    (key === undefined ? undefined : members.get(key)) ?? { name: '', colour: '' }

  const cookEvents = data.list('cook').flatMap(({ id, doc }) => {
    const row = cookRow.safeParse(doc)
    const meal = row.success ? meals.get(row.data.mealId) : undefined
    if (!row.success || row.data.week !== weekStart || !meal) return []
    const author = who(row.data.addedBy)
    return [
      {
        id: brand<string, 'CookEventId'>(id),
        mealId: brand<string, 'MealId'>(row.data.mealId),
        mealName: meal.name,
        date: row.data.date,
        slotKey: brand<string, 'SlotKey'>(row.data.slot),
        servingsCooked: brand<number, 'Servings'>(row.data.servings),
        addedByName: author.name,
        addedByColour: author.colour,
      },
    ]
  })

  const byId = new Map(cookEvents.map((c) => [String(c.id), c]))
  const leftovers = data.list('leftover').flatMap(({ id, doc }) => {
    const row = leftoverRow.safeParse(doc)
    const parent = row.success ? byId.get(row.data.cook) : undefined
    if (!row.success || !parent) return []
    return [
      {
        id: brand<string, 'LeftoverId'>(id),
        cookEventId: parent.id,
        parentMealName: parent.mealName,
        date: row.data.date,
        slotKey: brand<string, 'SlotKey'>(row.data.slot),
      },
    ]
  })

  const backlog = data
    .list('backlog')
    .flatMap(({ id, doc }) => {
      const row = backlogRow.safeParse(doc)
      const meal = row.success ? meals.get(row.data.mealId) : undefined
      if (!row.success || row.data.week !== weekStart || !meal) return []
      const author = who(row.data.addedBy)
      return [
        {
          at: row.data.createdAt,
          item: {
            id: brand<string, 'BacklogItemId'>(id),
            mealId: brand<string, 'MealId'>(row.data.mealId),
            mealName: meal.name,
            servings: meal.servings,
            addedByName: author.name,
            addedByColour: author.colour,
          },
        },
      ]
    })
    .sort((a, b) => a.at - b.at || a.item.id.localeCompare(b.item.id))
    .map((r) => r.item)

  return { cookEvents, leftovers, backlog }
}

const countIn = (data: Data, kind: string, field: string, value: string): number =>
  data.list(kind).filter(({ doc }) => doc[field] === value).length

const attempt = async <T>(write: () => Promise<T>): Promise<Result<T, PlanningError>> => {
  try {
    return ok(await write())
  } catch {
    return err('write-failed')
  }
}

export const addToBacklog = async (
  data: Data,
  random: Random,
  now: number,
  input: { weekStart: WeekStart; mealId: MealId; addedBy: string },
): Promise<Result<BacklogItemId, PlanningError>> => {
  if (countIn(data, 'backlog', 'week', input.weekStart) >= MAX_PER_WEEK) {
    return err('limit-reached')
  }
  const id = newId(random)
  return attempt(async () => {
    await data.put('backlog', id, {
      week: input.weekStart,
      mealId: input.mealId,
      addedBy: input.addedBy,
      createdAt: now,
    })
    return brand<string, 'BacklogItemId'>(id)
  })
}

export const removeBacklogItem = (
  data: Data,
  id: BacklogItemId,
): Promise<Result<void, PlanningError>> => attempt(() => data.remove('backlog', id))

type PlanInput = {
  readonly backlogItemId?: BacklogItemId | undefined
  readonly mealId: MealId
  readonly date: string
  readonly slotKey: SlotKey
  readonly servingsCooked: Servings
  readonly addedBy: string
}

/**
 * Planning straight onto the board, or claiming a Backlog Item. A claim whose
 * Item is already gone is a success with nothing to do: someone else planned it.
 */
export const planMeal = async (
  data: Data,
  random: Random,
  input: PlanInput,
): Promise<Result<CookEventId | undefined, PlanningError>> => {
  const week = weekStartOfDate(input.date)
  const claimed = input.backlogItemId
  if (claimed !== undefined && data.get('backlog', claimed) === undefined) return ok(undefined)
  if (countIn(data, 'cook', 'week', week) >= MAX_PER_WEEK) return err('limit-reached')
  const id = claimed ?? newId(random)
  return attempt(async () => {
    await data.put('cook', id, {
      week,
      mealId: input.mealId,
      date: input.date,
      slot: input.slotKey,
      servings: Number(input.servingsCooked),
      addedBy: input.addedBy,
      ...(claimed === undefined ? {} : { fromBacklog: claimed }),
    })
    if (claimed !== undefined) await data.remove('backlog', claimed)
    return brand<string, 'CookEventId'>(id)
  })
}

/** Removes the Cook Event and its Leftovers, and puts the Meal back on the Backlog (ADR 0004). */
export const unplanMeal = async (
  data: Data,
  random: Random,
  now: number,
  cookEventId: CookEventId,
  me: string,
): Promise<Result<BacklogItemId | undefined, PlanningError>> => {
  const row = cookRow.safeParse(data.get('cook', cookEventId) ?? {})
  if (!row.success) return ok(undefined)
  const restored = row.data.fromBacklog ?? newId(random)
  return attempt(async () => {
    await data.put('backlog', restored, {
      week: row.data.week,
      mealId: row.data.mealId,
      addedBy: row.data.addedBy ?? me,
      createdAt: now,
    })
    await data.remove('cook', cookEventId)
    for (const { id, doc } of data.list('leftover')) {
      if (doc.cook === cookEventId) await data.remove('leftover', id)
    }
    return brand<string, 'BacklogItemId'>(restored)
  })
}

/** Leftovers keep their own date and Slot: moving the Meal does not drag them along. */
export const moveCookEvent = (
  data: Data,
  input: { cookEventId: CookEventId; date: string; slotKey: SlotKey },
): Promise<Result<CookEventId, PlanningError>> =>
  attempt(async () => {
    // Moving to another week re-files it under that week's Monday.
    await data.put('cook', input.cookEventId, {
      date: input.date,
      slot: input.slotKey,
      week: weekStartOfDate(input.date),
    })
    return input.cookEventId
  })

export const setServingsCooked = (
  data: Data,
  cookEventId: CookEventId,
  servingsCooked: Servings,
): Promise<Result<CookEventId, PlanningError>> =>
  attempt(async () => {
    await data.put('cook', cookEventId, { servings: Number(servingsCooked) })
    return cookEventId
  })

export const addLeftover = async (
  data: Data,
  random: Random,
  input: { cookEventId: CookEventId; date: string; slotKey: SlotKey },
): Promise<Result<LeftoverId, PlanningError>> => {
  if (countIn(data, 'leftover', 'cook', input.cookEventId) >= MAX_LEFTOVERS_PER_COOK_EVENT) {
    return err('limit-reached')
  }
  const id = newId(random)
  return attempt(async () => {
    await data.put('leftover', id, {
      cook: input.cookEventId,
      date: input.date,
      slot: input.slotKey,
    })
    return brand<string, 'LeftoverId'>(id)
  })
}

export const moveLeftover = (
  data: Data,
  input: { leftoverId: LeftoverId; date: string; slotKey: SlotKey },
): Promise<Result<LeftoverId, PlanningError>> =>
  attempt(async () => {
    await data.put('leftover', input.leftoverId, { date: input.date, slot: input.slotKey })
    return input.leftoverId
  })

/** One Leftover card and nothing else; its Cook Event stays. */
export const removeLeftover = (data: Data, id: LeftoverId): Promise<Result<void, PlanningError>> =>
  attempt(() => data.remove('leftover', id))
