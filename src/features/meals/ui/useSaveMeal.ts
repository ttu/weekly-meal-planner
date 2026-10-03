import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { useSession } from '@/features/household'
import { saveMeal, type SaveMealError } from '../application/save-meal'
import { saveMealPhoto, type PhotoChange } from '../application/save-meal-photo'
import type { MealDraft } from '../domain/meal-draft'
import type { MealId } from '../domain/types'

type Draft = MealDraft & {
  readonly id?: MealId
  readonly photo?: PhotoChange
  readonly existingPhotoPath?: string | undefined
}

/** The Meal saved and the photo did not: a different sentence from "could not
 *  save the meal", because the Meal is already there. */
export type EditorError = SaveMealError | 'photo-failed'

export type SaveMeal = {
  readonly save: (draft: Draft, onSaved: () => void) => void
  readonly isPending: boolean
  readonly error: EditorError | undefined
}

const SAVE_MEAL_ERRORS: readonly EditorError[] = [
  'name-required',
  'name-too-long',
  'duplicate-ingredient',
  'write-failed',
  'photo-failed',
]

/** A photo that will not upload must not be reported as "could not save the
 *  meal" — the Meal is saved by then. */
const PHOTO_ERRORS = { 'read-failed': 'photo-failed', 'write-failed': 'photo-failed' } as const

/** The mutation carries the failure as an Error message; parse it back into the
 *  domain error rather than casting a string into one. */
const parseSaveMealError = (message: string | undefined): EditorError | undefined =>
  SAVE_MEAL_ERRORS.find((code) => code === message)

export const useSaveMeal = (): SaveMeal => {
  const { client, household } = useSession()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (draft: Draft) => {
      if (household === undefined) throw new Error('no-household')

      const result = await saveMeal(client, { ...draft, householdId: household.id })
      // The mutation surfaces failure through its error channel; the message is
      // a SaveMealError code the screen translates.
      if (isErr(result)) throw new Error(result.error)

      // After the Meal, because the photo's path contains the Meal's id.
      const photo = await saveMealPhoto(client, {
        householdId: household.id,
        mealId: result.value,
        change: draft.photo ?? { kind: 'unchanged' },
        existingPath: draft.existingPhotoPath,
      })
      if (isErr(photo)) throw new Error(PHOTO_ERRORS[photo.error])

      return result.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meals', household?.id] })
      // A renamed Meal changes what the board shows, too.
      void queryClient.invalidateQueries({ queryKey: ['week'] })
    },
  })

  return {
    save: (draft, onSaved) => {
      mutation.mutate(draft, { onSuccess: onSaved })
    },
    isPending: mutation.isPending,
    error: parseSaveMealError(mutation.error?.message),
  }
}
