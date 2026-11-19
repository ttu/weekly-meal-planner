import { systemClock, type Clock } from '@/shared/time/clock'
import { useBoardSession } from '@/features/household'
import type { MealId } from '@/features/meals'
import { useData, useSync } from '@/features/sync'
import { addToBacklog } from '../application/planning-data'
import { useSelectedWeek } from './SelectedWeek'
import { useWrite } from './useWrite'

export type AddToBacklog = {
  readonly add: (mealId: MealId) => void
  readonly isPending: boolean
  readonly hasFailed: boolean
}

export const useAddToBacklog = (clock: Clock = systemClock): AddToBacklog => {
  const { userId } = useBoardSession()
  const data = useData()
  const { deps } = useSync()
  const { weekStart } = useSelectedWeek(clock)
  const write = useWrite()

  return {
    add: (mealId) => {
      if (!data || userId === undefined) return
      write.run(() =>
        addToBacklog(data, deps.random, deps.clock.now().getTime(), {
          weekStart,
          mealId,
          addedBy: userId,
        }),
      )
    },
    isPending: write.pending,
    hasFailed: write.failed,
  }
}
