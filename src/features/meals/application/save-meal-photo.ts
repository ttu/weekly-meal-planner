import { isErr, ok, type Result } from '@/shared/types/result'
import type { AppSupabaseClient, HouseholdId } from '@/features/household'
import { mealPhotoPath } from '../domain/photo'
import {
  deleteMealPhoto,
  readPickedPhoto,
  setMealPhotoPath,
  uploadMealPhoto,
  type PhotoError,
} from '../infrastructure/meal-photo-repository'
import type { MealId } from '../domain/types'

/**
 * What the editor is holding when Save is pressed: a freshly picked image, an
 * instruction to clear the one that is there, or nothing to do.
 */
export type PhotoChange =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'picked'; readonly uri: string; readonly contentType: string }
  | { readonly kind: 'cleared' }

/**
 * Runs after the Meal is saved, because the object's path contains the Meal's
 * id and a new Meal has none until then.
 *
 * The object is written before the column, so a failure leaves a file nobody
 * references rather than a reference to a file that is not there — the first
 * is invisible, the second is a broken card.
 */
export const saveMealPhoto = async (
  client: AppSupabaseClient,
  input: {
    readonly householdId: HouseholdId
    readonly mealId: MealId
    readonly change: PhotoChange
    /** The object currently behind the Meal, if it has one. */
    readonly existingPath?: string | undefined
  },
): Promise<Result<undefined, PhotoError>> => {
  const { change } = input
  if (change.kind === 'unchanged') return ok(undefined)

  if (change.kind === 'cleared') {
    const cleared = await setMealPhotoPath(client, input.mealId, undefined)
    if (isErr(cleared)) return cleared
    if (input.existingPath !== undefined) await deleteMealPhoto(client, input.existingPath)
    return ok(undefined)
  }

  const body = await readPickedPhoto(change.uri)
  if (isErr(body)) return body

  const contentType = body.value.type === '' ? change.contentType : body.value.type
  const path = mealPhotoPath(input.householdId, input.mealId, contentType)

  const uploaded = await uploadMealPhoto(client, path, body.value, contentType)
  if (isErr(uploaded)) return uploaded

  const written = await setMealPhotoPath(client, input.mealId, path)
  if (isErr(written)) return written

  // A replacement with a different extension leaves the old file behind.
  if (input.existingPath !== undefined && input.existingPath !== path) {
    await deleteMealPhoto(client, input.existingPath)
  }

  return ok(undefined)
}
