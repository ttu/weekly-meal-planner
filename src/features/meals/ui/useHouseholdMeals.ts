import { useQuery } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { useSession } from '@/features/household'
import { loadMeals } from '../infrastructure/meal-repository'
import type { Meal } from '../domain/types'

export type HouseholdMeals = {
  readonly meals: readonly Meal[]
  readonly isLoading: boolean
  /** The last load failed. With `hasData`, a refresh failed over a library still
   *  worth showing; without it, there is no library to show. */
  readonly isError: boolean
  /** An answer has arrived, so an empty library really is empty. */
  readonly hasData: boolean
  readonly refetch: () => void
}

export const useHouseholdMeals = (): HouseholdMeals => {
  const { client, household } = useSession()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['meals', household?.id, household?.locale],
    enabled: household !== undefined,
    queryFn: async () => {
      const result = await loadMeals(client, household?.locale ?? 'en')
      // Thrown, not emptied: Query keeps the last good library on a failed refresh.
      if (isErr(result)) throw new Error(`Could not load Meals: ${result.error}`)
      return result.value
    },
  })

  return {
    meals: data ?? [],
    isLoading,
    isError,
    hasData: data !== undefined,
    refetch: () => {
      void refetch()
    },
  }
}
