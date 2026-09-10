import { useQuery } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { useSession } from '@/features/household'
import { loadIngredients } from '../infrastructure/ingredient-repository'
import type { Ingredient } from '../domain/types'

export const useIngredients = (): { ingredients: readonly Ingredient[]; isLoading: boolean } => {
  const { client, household } = useSession()

  const { data, isLoading } = useQuery({
    queryKey: ['ingredients', household?.locale],
    enabled: household !== undefined,
    queryFn: async () => {
      if (household === undefined) return []
      const result = await loadIngredients(client, household.locale)
      return isErr(result) ? [] : result.value
    },
  })

  return { ingredients: data ?? [], isLoading }
}
