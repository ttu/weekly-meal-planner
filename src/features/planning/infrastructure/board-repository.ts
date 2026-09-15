import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { CookEvent, Leftover, WeekStart } from '../domain/types'

const cookEventRow = z.object({
  id: z.uuid(),
  meal_id: z.uuid(),
  date: z.string(),
  slot_key: z.string(),
  servings_cooked: z.number().int(),
  added_by: z.uuid().nullable(),
  meal: z.object({ name: z.string() }),
})

const memberRow = z.object({
  user_id: z.uuid(),
  display_name: z.string(),
  colour: z.string(),
})

const leftoverRow = z.object({
  id: z.uuid(),
  cook_event_id: z.uuid(),
  date: z.string(),
  slot_key: z.string(),
  cook_event: z.object({ meal: z.object({ name: z.string() }) }),
})

export type LoadWeekError = 'no-week-plan' | 'invalid-row'

export type WeekContents = {
  readonly weekPlanId: string
  readonly cookEvents: readonly CookEvent[]
  readonly leftovers: readonly Leftover[]
}

export const loadWeek = async (
  client: AppSupabaseClient,
  weekStart: WeekStart,
): Promise<Result<WeekContents, LoadWeekError>> => {
  // No household_id filter: RLS already restricts the row set (ADR 0002).
  const { data: plan } = await client
    .from('week_plan')
    .select('id')
    .eq('week_start', weekStart)
    .maybeSingle()
  if (plan === null) return err('no-week-plan')

  const planId = plan.id

  const { data: cookEventData } = await client
    .from('cook_event')
    .select('id,meal_id,date,slot_key,servings_cooked,added_by,meal(name)')
    .eq('week_plan_id', planId)

  const { data: leftoverData } = await client
    .from('leftover')
    .select('id,cook_event_id,date,slot_key,cook_event!inner(week_plan_id,meal(name))')
    .eq('cook_event.week_plan_id', planId)

  // `added_by` is a user id, not a foreign key to household_member — a Member
  // can leave while the Meal they planned stays — so the Member is looked up
  // separately and joined in memory, with a blank for one who has since left.
  const { data: memberData } = await client
    .from('household_member')
    .select('user_id,display_name,colour')

  const cookEvents = z.array(cookEventRow).safeParse(cookEventData ?? [])
  const leftovers = z.array(leftoverRow).safeParse(leftoverData ?? [])
  const members = z.array(memberRow).safeParse(memberData ?? [])
  if (!cookEvents.success || !leftovers.success || !members.success) return err('invalid-row')

  const byUserId = new Map(members.data.map((m) => [m.user_id, m]))

  return ok({
    weekPlanId: planId,
    cookEvents: cookEvents.data.map((r) => ({
      id: brand<string, 'CookEventId'>(r.id),
      mealId: brand<string, 'MealId'>(r.meal_id),
      mealName: r.meal.name,
      date: r.date,
      slotKey: brand<string, 'SlotKey'>(r.slot_key),
      servingsCooked: brand<number, 'Servings'>(r.servings_cooked),
      addedByName: (r.added_by === null ? undefined : byUserId.get(r.added_by))?.display_name ?? '',
      addedByColour: (r.added_by === null ? undefined : byUserId.get(r.added_by))?.colour ?? '',
    })),
    leftovers: leftovers.data.map((r) => ({
      id: brand<string, 'LeftoverId'>(r.id),
      cookEventId: brand<string, 'CookEventId'>(r.cook_event_id),
      parentMealName: r.cook_event.meal.name,
      date: r.date,
      slotKey: brand<string, 'SlotKey'>(r.slot_key),
    })),
  })
}
