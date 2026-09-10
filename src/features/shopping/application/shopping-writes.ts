import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient, HouseholdId } from '@/features/household'
import type { IngredientId } from '@/shared/types/ids'
import type { ExtraId } from '../domain/types'

export type ShoppingWriteError = 'write-failed'

const done = (error: unknown): Result<void, ShoppingWriteError> =>
  error === null ? ok(undefined) : err('write-failed')

export const setChecked = async (
  client: AppSupabaseClient,
  weekPlanId: string,
  ingredientId: IngredientId,
  checked: boolean,
): Promise<Result<void, ShoppingWriteError>> => {
  const { error } = checked
    ? await client
        .from('shopping_check')
        .upsert({ week_plan_id: weekPlanId, ingredient_id: ingredientId })
    : await client
        .from('shopping_check')
        .delete()
        .eq('week_plan_id', weekPlanId)
        .eq('ingredient_id', ingredientId)

  return done(error)
}

/** Marks a Staple as running low, which promotes it onto the Buy list. */
export const markRunningLow = async (
  client: AppSupabaseClient,
  householdId: HouseholdId,
  ingredientId: IngredientId,
): Promise<Result<void, ShoppingWriteError>> => {
  const { error } = await client
    .from('household_staple')
    .update({ running_low: true, marked_low_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .eq('ingredient_id', ingredientId)

  return done(error)
}

export const addExtra = async (
  client: AppSupabaseClient,
  weekPlanId: string,
  label: string,
): Promise<Result<void, ShoppingWriteError>> => {
  const trimmed = label.trim()
  if (trimmed.length === 0) return err('write-failed')

  const { error } = await client
    .from('shopping_extra')
    .insert({ week_plan_id: weekPlanId, label: trimmed })

  return done(error)
}

export const setExtraChecked = async (
  client: AppSupabaseClient,
  id: ExtraId,
  checked: boolean,
): Promise<Result<void, ShoppingWriteError>> => {
  const { error } = await client
    .from('shopping_extra')
    .update({ checked_at: checked ? new Date().toISOString() : null })
    .eq('id', id)

  return done(error)
}
