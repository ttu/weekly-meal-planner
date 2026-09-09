import { ok, err, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { AppSupabaseClient, HouseholdId } from '@/features/household'
import type { MealId } from '@/features/meals'
import type { BacklogItemId, WeekStart } from '../domain/types'

export type AddToBacklogError = 'no-household' | 'write-failed'

type Input = {
  readonly householdId: HouseholdId
  readonly weekStart: WeekStart
  readonly mealId: MealId
  readonly addedBy: string
}

/**
 * The Week Plan may not exist yet — nobody has planned this week. Creating one
 * on demand is the right behaviour: wanting tacos should not require someone to
 * have "started" the week first.
 *
 * upsert with ignoreDuplicates handles the race where two Members add to an
 * unplanned week at the same moment; the unique (household_id, week_start)
 * constraint makes it safe.
 */
const resolveWeekPlanId = async (
  client: AppSupabaseClient,
  householdId: HouseholdId,
  weekStart: WeekStart,
): Promise<string | undefined> => {
  await client
    .from('week_plan')
    .upsert(
      { household_id: householdId, week_start: weekStart },
      { onConflict: 'household_id,week_start', ignoreDuplicates: true },
    )

  const { data } = await client
    .from('week_plan')
    .select('id')
    .eq('week_start', weekStart)
    .maybeSingle()

  return data?.id
}

export const addToBacklog = async (
  client: AppSupabaseClient,
  { householdId, weekStart, mealId, addedBy }: Input,
): Promise<Result<BacklogItemId, AddToBacklogError>> => {
  const weekPlanId = await resolveWeekPlanId(client, householdId, weekStart)
  if (weekPlanId === undefined) return err('no-household')

  const { data, error } = await client
    .from('backlog_item')
    .insert({ week_plan_id: weekPlanId, meal_id: mealId, added_by: addedBy })
    .select('id')
    .single()

  // .single() discriminates the result union: a null error guarantees a row.
  if (error !== null) return err('write-failed')

  return ok(brand<string, 'BacklogItemId'>(data.id))
}
