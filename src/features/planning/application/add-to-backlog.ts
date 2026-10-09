import { ok, err, type Result } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { AppSupabaseClient, HouseholdId } from '@/features/household'
import type { MealId } from '@/features/meals'
import { resolveWeekPlanId } from './resolve-week-plan'
import type { BacklogItemId, WeekStart } from '../domain/types'

export type AddToBacklogError = 'no-household' | 'write-failed'

type Input = {
  readonly householdId: HouseholdId
  readonly weekStart: WeekStart
  readonly mealId: MealId
  readonly addedBy: string
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
