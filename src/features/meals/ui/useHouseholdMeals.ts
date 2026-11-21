import { useMemo } from 'react'
import { useBoardSession } from '@/features/household'
import { useData, useView } from '@/features/sync'
import { listMeals } from '../application/meals-data'
import type { Meal } from '../domain/types'

export type HouseholdMeals = {
  readonly meals: readonly Meal[]
  readonly isLoading: boolean
  /** The device has looked for its board, so an empty library really is empty. */
  readonly hasData: boolean
}

export const useHouseholdMeals = (): HouseholdMeals => {
  const { household, checked } = useBoardSession()
  const data = useData()
  const view = useView()
  const meals = useMemo(
    () => (household && data ? listMeals(data, household.id, household.locale) : []),
    // `view` changes whenever the board does, which is when the rows may have.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [household, data, view],
  )
  return { meals, isLoading: !checked, hasData: checked }
}
