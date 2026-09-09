import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { useSession } from '@/features/household'
import { saveMeal, type SaveMealError } from '../application/save-meal'
import type { MealDraft } from '../domain/meal-draft'
import type { MealId } from '../domain/types'

export type SaveMeal = {
  readonly save: (draft: MealDraft & { id?: MealId }, onSaved: () => void) => void
  readonly isPending: boolean
  readonly error: SaveMealError | undefined
}

const SAVE_MEAL_ERRORS: readonly SaveMealError[] = [
  'name-required',
  'name-too-long',
  'duplicate-ingredient',
  'write-failed',
]

/** The mutation carries the failure as an Error message; parse it back into the
 *  domain error rather than casting a string into one. */
const parseSaveMealError = (message: string | undefined): SaveMealError | undefined =>
  SAVE_MEAL_ERRORS.find((code) => code === message)

export const useSaveMeal = (): SaveMeal => {
  const { client, household } = useSession()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (draft: MealDraft & { id?: MealId }) => {
      if (household === undefined) throw new Error('no-household')

      const result = await saveMeal(client, { ...draft, householdId: household.id })
      // The mutation surfaces failure through its error channel; the message is
      // a SaveMealError code the screen translates.
      if (isErr(result)) throw new Error(result.error)
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
