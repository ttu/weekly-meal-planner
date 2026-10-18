import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { useSession } from '@/features/household'
import { copyCatalogueMeal } from '../application/copy-catalogue-meal'
import { deleteMeal } from '../application/delete-meal'
import { loadMeal, type MealDetail } from '../infrastructure/meal-repository'
import type { MealId } from '../domain/types'
import { IDEMPOTENT_WRITE_RETRY } from '@/shared/net/queryClient'

export const useMeal = (id: MealId | undefined): { meal: MealDetail | undefined } => {
  const { client } = useSession()

  const { data } = useQuery({
    queryKey: ['meal', id],
    enabled: id !== undefined,
    queryFn: async () => {
      if (id === undefined) return undefined
      const result = await loadMeal(client, id)
      return isErr(result) ? undefined : result.value
    },
  })

  return { meal: data }
}

export type MealActions = {
  readonly copy: (sourceId: MealId) => void
  readonly remove: (id: MealId, onRemoved: () => void) => void
  readonly hasFailed: boolean
}

export const useMealActions = (): MealActions => {
  const { client, household } = useSession()
  const queryClient = useQueryClient()

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['meals', household?.id] })
    void queryClient.invalidateQueries({ queryKey: ['week'] })
  }

  const copyMutation = useMutation({
    mutationFn: async (sourceId: MealId) => {
      if (household === undefined) throw new Error('no-household')
      const result = await copyCatalogueMeal(client, household.id, sourceId)
      if (isErr(result)) throw new Error(result.error)
      return result.value
    },
    onSettled: invalidate,
  })

  const deleteMutation = useMutation({
    retry: IDEMPOTENT_WRITE_RETRY, // set-to-value / upsert / delete: repeating it changes nothing
    mutationFn: async (id: MealId) => {
      const result = await deleteMeal(client, id)
      if (isErr(result)) throw new Error(result.error)
    },
    onSettled: invalidate,
  })

  return {
    copy: (sourceId) => {
      copyMutation.mutate(sourceId)
    },
    remove: (id, onRemoved) => {
      deleteMutation.mutate(id, { onSuccess: onRemoved })
    },
    hasFailed: copyMutation.isError || deleteMutation.isError,
  }
}
