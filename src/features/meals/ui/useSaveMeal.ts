import { useState } from 'react'
import { isErr } from '@/shared/types/result'
import { useData, useSync } from '@/features/sync'
import { saveMeal, type SaveMealError } from '../application/meals-data'
import type { MealDraft } from '../domain/meal-draft'
import type { MealId } from '../domain/types'

type Draft = MealDraft & { readonly id?: MealId }

export type EditorError = SaveMealError

export type SaveMeal = {
  readonly save: (draft: Draft, onSaved: () => void) => void
  readonly isPending: boolean
  readonly error: EditorError | undefined
}

export const useSaveMeal = (): SaveMeal => {
  const data = useData()
  const { deps } = useSync()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<EditorError | undefined>(undefined)

  return {
    save: (draft, onSaved) => {
      if (!data) return
      setPending(true)
      setError(undefined)
      void saveMeal(data, deps.random, draft).then((result) => {
        setPending(false)
        if (isErr(result)) setError(result.error)
        else onSaved()
      })
    },
    isPending,
    error,
  }
}
