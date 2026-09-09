import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { BacklogItem } from '../domain/types'

const rowSchema = z.object({
  id: z.uuid(),
  meal_id: z.uuid(),
  added_by: z.uuid(),
  meal: z.object({ name: z.string(), servings: z.number().int() }),
})

const memberSchema = z.object({
  user_id: z.uuid(),
  display_name: z.string(),
  colour: z.string(),
})

export type LoadBacklogError = 'invalid-row'

/**
 * `added_by` is a user id, not a foreign key to household_member: a Member can
 * leave while their Backlog Item stays, and the card should still say who
 * wanted it. That is why the Member lookup is a separate query joined in
 * memory, with a fallback for a Member who has since left.
 */
export const loadBacklog = async (
  client: AppSupabaseClient,
  weekPlanId: string,
): Promise<Result<readonly BacklogItem[], LoadBacklogError>> => {
  const { data } = await client
    .from('backlog_item')
    .select('id,meal_id,added_by,meal(name,servings)')
    .eq('week_plan_id', weekPlanId)
    .order('created_at', { ascending: true })

  const rows = z.array(rowSchema).safeParse(data ?? [])
  if (!rows.success) return err('invalid-row')

  const { data: memberData } = await client
    .from('household_member')
    .select('user_id,display_name,colour')

  const members = z.array(memberSchema).safeParse(memberData ?? [])
  if (!members.success) return err('invalid-row')

  const byUserId = new Map(members.data.map((m) => [m.user_id, m]))

  return ok(
    rows.data.map((r) => {
      const member = byUserId.get(r.added_by)
      return {
        id: brand<string, 'BacklogItemId'>(r.id),
        mealId: brand<string, 'MealId'>(r.meal_id),
        mealName: r.meal.name,
        servings: brand<number, 'Servings'>(r.meal.servings),
        addedByName: member?.display_name ?? '',
        addedByColour: member?.colour ?? '',
      }
    }),
  )
}
