import { z } from 'zod'
import type { Locale } from './index'

/** Rows of `ingredient_name`, or any table shaped like it. */
export const localisedNameSchema = z.array(
  z.object({ locale: z.enum(['fi', 'en']), name: z.string() }),
)

export type LocalisedName = z.infer<typeof localisedNameSchema>

/**
 * The name for this Locale, falling back to whichever the row has.
 *
 * A Household-created Ingredient may only carry one Locale, and showing its
 * slug instead of the name the family typed would be worse than showing the
 * wrong language.
 */
export const resolveLocalisedName = (
  names: LocalisedName,
  locale: Locale,
  fallback: string,
): string => names.find((n) => n.locale === locale)?.name ?? names[0]?.name ?? fallback
