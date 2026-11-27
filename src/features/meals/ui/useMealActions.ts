import { useMemo, useState } from 'react'
import { isErr } from '@/shared/types/result'
import { useBoardSession } from '@/features/household'
import { useData, useSync, useView } from '@/features/sync'
import { copyCatalogueMeal, deleteMeal, getMeal } from '../application/meals-data'
import type { MealDetail, MealId } from '../domain/types'

export const useMeal = (id: MealId | undefined): { meal: MealDetail | undefined } => {
  const { household } = useBoardSession()
  const data = useData()
  const view = useView()
  const meal = useMemo(
    () => (id && household && data ? getMeal(data, household.id, household.locale, id) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, household, data, view],
  )
  return { meal }
}

export type MealActions = {
  readonly copy: (sourceId: MealId) => void
  readonly remove: (id: MealId, onRemoved: () => void) => void
  readonly hasFailed: boolean
}

export const useMealActions = (): MealActions => {
  const { household } = useBoardSession()
  const data = useData()
  const { deps } = useSync()
  const [hasFailed, setFailed] = useState(false)

  return {
    copy: (sourceId) => {
      if (!household || !data) return
      setFailed(false)
      void copyCatalogueMeal(data, deps.random, household.locale, sourceId).then((result) => {
        if (isErr(result)) setFailed(true)
      })
    },
    remove: (id, onRemoved) => {
      if (!data) return
      setFailed(false)
      void deleteMeal(data, id).then((result) => {
        if (isErr(result)) setFailed(true)
        else onRemoved()
      })
    },
    hasFailed,
  }
}
