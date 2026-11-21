import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { err, ok, type Result } from '@/shared/types/result'
import type { SlotKey } from '@/features/household'
import { MAX_SERVINGS, type MealId, type Servings } from '@/features/meals'
import { newId, type Data, type Doc, type Random } from '@/features/sync'
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
 *   cook:<id>      place { week, date, slot }, mealId, servings, addedBy?, fromBacklog?
 *   leftover:<id>  cook, date, slot
 *
 * Planning a Backlog Item gives the Cook Event the Item's own id, so two Members
 * planning it at once write the same row and converge on one Cook Event, which
 * is what the old `plan_meal` guaranteed by deleting the Item first. Unplanning
 * brings the Item back under that id with its author intact. A Meal that no
 * longer exists, or a Cook Event that is gone, hides what hangs off it instead
 * of leaving a card for nothing.
 *
 * A Cook Event's place is one field, so two Members moving it at once cannot
 * leave it with one's date and the other's week. Rows written before that keep
 * `week`, `date` and `slot` as fields of their own, and are still read.
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
const placeRow = z.object({ week: z.string(), date: z.string(), slot: z.string() })
const cookFields = z.object({
  mealId: z.string(),
  servings: z.number().int().min(1).max(MAX_SERVINGS),
  addedBy: z.string().optional(),
  fromBacklog: z.string().optional(),
})
type CookRow = z.infer<typeof cookFields> & z.infer<typeof placeRow>

const cookRow = (doc: Doc | undefined): CookRow | undefined => {
  const fields = cookFields.safeParse(doc ?? {})
  const place = placeRow.safeParse(doc?.place ?? doc ?? {})
  return fields.success && place.success ? { ...fields.data, ...place.data } : undefined
}

const placeOf = (date: string, slot: SlotKey) => ({
  place: { week: weekStartOfDate(date), date, slot },
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
    const row = cookRow(doc)
    const meal = row ? meals.get(row.mealId) : undefined
    if (!row || row.week !== weekStart || !meal) return []
    const author = who(row.addedBy)
    return [
      {
        id: brand<string, 'CookEventId'>(id),
        mealId: brand<string, 'MealId'>(row.mealId),
        mealName: meal.name,
        date: row.date,
        slotKey: brand<string, 'SlotKey'>(row.slot),
        servingsCooked: brand<number, 'Servings'>(row.servings),
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
  const planned = data.list('cook').filter(({ doc }) => cookRow(doc)?.week === week).length
  if (planned >= MAX_PER_WEEK) return err('limit-reached')
  const id = claimed ?? newId(random)
  return attempt(async () => {
    // The id comes back from the Backlog: a Leftover someone added to it while it was off the board must not.
    if (claimed !== undefined) await removeLeftoversOf(data, id)
    await data.put('cook', id, {
      ...placeOf(input.date, input.slotKey),
      mealId: input.mealId,
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
  now: number,
  cookEventId: CookEventId,
  me: string,
): Promise<Result<BacklogItemId | undefined, PlanningError>> => {
  const row = cookRow(data.get('cook', cookEventId))
  if (!row) return ok(undefined)
  // Never a fresh id: two Members unplanning at once must write the same Backlog Item.
  const restored = row.fromBacklog ?? cookEventId
  return attempt(async () => {
    await data.put('backlog', restored, {
      week: row.week,
      mealId: row.mealId,
      addedBy: row.addedBy ?? me,
      createdAt: now,
    })
    await data.remove('cook', cookEventId)
    await removeLeftoversOf(data, cookEventId)
    return brand<string, 'BacklogItemId'>(restored)
  })
}

const removeLeftoversOf = async (data: Data, cookEventId: string): Promise<void> => {
  for (const { id, doc } of data.list('leftover')) {
    if (doc.cook === cookEventId) await data.remove('leftover', id)
  }
}

/**
 * A change to a row someone else removed is a success with nothing to do: a put
 * would bring the row back, a Cook Event on the board and its Backlog Item at once.
 */
const changeIfThere = async <Id extends string>(
  data: Data,
  kind: string,
  id: Id,
  write: () => Promise<void>,
): Promise<Result<Id, PlanningError>> => {
  if (data.get(kind, id) === undefined) return ok(id)
  return attempt(async () => {
    await write()
    return id
  })
}

/** Leftovers keep their own date and Slot: moving the Meal does not drag them along. */
export const moveCookEvent = (
  data: Data,
  input: { cookEventId: CookEventId; date: string; slotKey: SlotKey },
): Promise<Result<CookEventId, PlanningError>> =>
  changeIfThere(data, 'cook', input.cookEventId, () =>
    // Moving to another week re-files it under that week's Monday.
    data.put('cook', input.cookEventId, placeOf(input.date, input.slotKey)),
  )

export const setServingsCooked = (
  data: Data,
  cookEventId: CookEventId,
  servingsCooked: Servings,
): Promise<Result<CookEventId, PlanningError>> =>
  changeIfThere(data, 'cook', cookEventId, () =>
    data.put('cook', cookEventId, { servings: Number(servingsCooked) }),
  )

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
  changeIfThere(data, 'leftover', input.leftoverId, () =>
    data.put('leftover', input.leftoverId, { date: input.date, slot: input.slotKey }),
  )

/** One Leftover card and nothing else; its Cook Event stays. */
export const removeLeftover = (data: Data, id: LeftoverId): Promise<Result<void, PlanningError>> =>
  attempt(() => data.remove('leftover', id))
