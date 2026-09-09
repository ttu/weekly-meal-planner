import { useQuery } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { useSession } from '@/features/household'
import { loadMeals } from '../infrastructure/meal-repository'
import type { Meal } from '../domain/types'

export const useHouseholdMeals = (): { meals: readonly Meal[]; isLoading: boolean } => {
  const { client, household } = useSession()

  const { data, isLoading } = useQuery({
    queryKey: ['meals', household?.id],
    enabled: household !== undefined,
    queryFn: async () => {
      const result = await loadMeals(client)
      return isErr(result) ? [] : result.value
    },
  })

  return { meals: data ?? [], isLoading }
}
