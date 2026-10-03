import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import { isStoredPhoto } from '../domain/photo'
import type { MealId } from '../domain/types'

const BUCKET = 'meal-photo'

/** An hour is long enough for a cooking session and short enough that a URL
 *  copied out of the page stops working. */
const SIGNED_FOR_SECONDS = 3600

export type PhotoError = 'read-failed' | 'write-failed'

/**
 * The picked image's bytes. The picker hands back a uri — `blob:` on the web,
 * `file:` on a phone — and fetch is the one reader both platforms have.
 */
export const readPickedPhoto = async (uri: string): Promise<Result<Blob, PhotoError>> => {
  try {
    const response = await fetch(uri)
    if (!response.ok) return err('read-failed')
    return ok(await response.blob())
  } catch {
    return err('read-failed')
  }
}

export const uploadMealPhoto = async (
  client: AppSupabaseClient,
  path: string,
  body: Blob,
  contentType: string,
): Promise<Result<string, PhotoError>> => {
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true })

  if (error !== null) return err('write-failed')
  return ok(path)
}

export const deleteMealPhoto = async (
  client: AppSupabaseClient,
  path: string,
): Promise<Result<undefined, PhotoError>> => {
  const { error } = await client.storage.from(BUCKET).remove([path])
  if (error !== null) return err('write-failed')
  return ok(undefined)
}

/** The path, or undefined to clear it. Separate from `save_meal` because the
 *  path is not knowable until the Meal has an id. */
export const setMealPhotoPath = async (
  client: AppSupabaseClient,
  mealId: MealId,
  path: string | undefined,
): Promise<Result<undefined, PhotoError>> => {
  const { error } = await client
    .from('meal')
    .update({ photo_url: path ?? null })
    .eq('id', mealId)

  if (error !== null) return err('write-failed')
  return ok(undefined)
}

/**
 * Signed URLs for every stored path in one round trip, keyed by path.
 *
 * A path that cannot be signed — the object is gone, or belongs to another
 * Household — is simply absent from the map, and the card falls back to its
 * initial. A missing photo is not worth an error.
 */
export const signMealPhotos = async (
  client: AppSupabaseClient,
  photoUrls: readonly string[],
): Promise<ReadonlyMap<string, string>> => {
  const paths = [...new Set(photoUrls.filter(isStoredPhoto))]
  if (paths.length === 0) return new Map()

  const { data } = await client.storage.from(BUCKET).createSignedUrls(paths, SIGNED_FOR_SECONDS)

  return new Map(
    (data ?? []).flatMap((entry) =>
      entry.path === null || entry.signedUrl === null || entry.signedUrl === ''
        ? []
        : [[entry.path, entry.signedUrl]],
    ),
  )
}
