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

/**
 * "We always have this in." The Ingredient leaves the Buy list and joins the
 * Cupboard Check, where it waits to be declared run out.
 *
 * This is the half of Staples the app never had a control for: spices, oil and
 * flour are bought in quantities that last months, and a Shopping List that
 * asks for them every week is a list nobody reads to the end.
 */
export const makeStaple = async (
  client: AppSupabaseClient,
  householdId: HouseholdId,
  ingredientId: IngredientId,
): Promise<Result<void, ShoppingWriteError>> => {
  const { error } = await client
    .from('household_staple')
    .upsert({ household_id: householdId, ingredient_id: ingredientId, running_low: false })

  return done(error)
}

/** No longer something the household keeps in; it goes back on the Buy list. */
export const forgetStaple = async (
  client: AppSupabaseClient,
  householdId: HouseholdId,
  ingredientId: IngredientId,
): Promise<Result<void, ShoppingWriteError>> => {
  const { error } = await client
    .from('household_staple')
    .delete()
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
