import { useMemo } from 'react'
import type { MealId } from '@/features/meals'
import { useData, useView } from '@/features/sync'
import { countCookEventsOf } from '../application/planning-data'

/** How many Cook Events a Meal has across every week, kept current as the board syncs. */
export const usePlannedCount = (mealId: MealId): number => {
  const data = useData()
  const view = useView()
  // `view` changes whenever the board does, which is when the rows may have.
  return useMemo(
    () => (data === undefined || view === undefined ? 0 : countCookEventsOf(data, mealId)),
    [data, view, mealId],
  )
}
