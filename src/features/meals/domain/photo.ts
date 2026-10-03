import type { HouseholdId, MealId } from './types'

/**
 * A Meal's photo is an object in Storage, and `meal.photo_url` holds its path
 * rather than a URL: the bucket is private, so the URL is signed on demand and
 * does not survive being written down.
 *
 * The exception is an absolute URL, which a Catalogue Meal may carry for a
 * picture we do not host. Telling the two apart is this one rule.
 */
export const isStoredPhoto = (photoUrl: string): boolean => !/^https?:\/\//i.test(photoUrl)

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export const photoExtension = (contentType: string): string =>
  EXTENSIONS[contentType.toLowerCase()] ?? 'jpg'

/**
 * `<household id>/<meal id>.<ext>`. The first segment is the whole of the
 * authorization question, which is what the Storage policy checks; the second
 * means one Meal has one photo, and replacing it overwrites rather than
 * accumulating orphans.
 */
export const mealPhotoPath = (
  householdId: HouseholdId,
  mealId: MealId,
  contentType: string,
): string => `${householdId}/${mealId}.${photoExtension(contentType)}`
