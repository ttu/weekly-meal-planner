import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import type { MealId } from '@/features/meals'
import { addToBacklog } from '../application/add-to-backlog'
import { useSelectedWeek } from './SelectedWeek'

export type AddToBacklog = {
  readonly add: (mealId: MealId) => void
  readonly isPending: boolean
  readonly hasFailed: boolean
}

export const useAddToBacklog = (clock: Clock = systemClock): AddToBacklog => {
  const { client, household, userId } = useSession()
  const queryClient = useQueryClient()
  const { weekStart } = useSelectedWeek(clock)

  const mutation = useMutation({
    mutationFn: async (mealId: MealId) => {
      if (household === undefined || userId === undefined) throw new Error('not-signed-in')

      const result = await addToBacklog(client, {
        householdId: household.id,
        weekStart,
        mealId,
        addedBy: userId,
      })
      if (isErr(result)) throw new Error(result.error)
      return result.value
    },
    onSettled: () => {
      // Refetch rather than patch the cache: the server assigns the id and the
      // Member's display name comes from a join, so a hand-built optimistic row
      // would be a guess at both.
      void queryClient.invalidateQueries({ queryKey: ['week', household?.id, weekStart] })
    },
  })

  return {
    add: (mealId) => {
      mutation.mutate(mealId)
    },
    isPending: mutation.isPending,
    hasFailed: mutation.isError,
  }
}
