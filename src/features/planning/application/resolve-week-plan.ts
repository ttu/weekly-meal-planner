import type { AppSupabaseClient, HouseholdId } from '@/features/household'
import type { WeekStart } from '../domain/types'

/**
 * The Week Plan for a week, created if this is the first thing anyone has put
 * in it.
 *
 * A week only gets a row once someone plans into it, so every write that can
 * be the first one has to be able to make it. The board can now be pointed at
 * any week, and the week ahead is empty by definition — planning into it used
 * to find no Week Plan and quietly put the Meal in the Backlog instead.
 *
 * upsert with ignoreDuplicates handles the race where two Members write into
 * an unplanned week at the same moment; the unique (household_id, week_start)
 * constraint makes it safe.
 */
export const resolveWeekPlanId = async (
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

  // Keyed by both halves of the unique constraint, not just the week. RLS
  // already keeps one Household from seeing another's rows (ADR 0002), so the
  // household_id is not the authorization here — it is the other half of the
  // question. Asked with the week alone, a Member of two Households would
  // match two rows and `maybeSingle` would fail the write rather than pick.
  const { data } = await client
    .from('week_plan')
    .select('id')
    .eq('household_id', householdId)
    .eq('week_start', weekStart)
    .maybeSingle()

  return data?.id
}
