import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import { currentWeekStart, useWeekBoard } from '@/features/planning'
import type { IngredientId } from '@/shared/types/ids'
import { loadShoppingData } from '../infrastructure/shopping-repository'
import { deriveShoppingList } from '../domain/derive'
import {
  addExtra,
  markRunningLow,
  setChecked,
  setExtraChecked,
} from '../application/shopping-writes'
import type { ExtraId, ShoppingList } from '../domain/types'

const EMPTY: ShoppingList = { buy: [], cupboard: [], extras: [], incomplete: [] }

export type ShoppingListView = {
  readonly list: ShoppingList
  readonly isLoading: boolean
  readonly toggle: (ingredientId: IngredientId, checked: boolean) => void
  readonly outOf: (ingredientId: IngredientId) => void
  readonly addItem: (label: string) => void
  readonly toggleExtra: (id: ExtraId, checked: boolean) => void
}

export const useShoppingList = (clock: Clock = systemClock): ShoppingListView => {
  const { client, household } = useSession()
  const { weekPlanId } = useWeekBoard(clock)
  const queryClient = useQueryClient()
  const weekStart = currentWeekStart(clock)
  const queryKey = ['shopping', household?.id, weekStart]

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: weekPlanId !== undefined && household !== undefined,
    queryFn: async () => {
      if (weekPlanId === undefined || household === undefined) return EMPTY
      const result = await loadShoppingData(client, weekPlanId, household.locale)
      // Derived on every render, never stored: a stored list goes stale exactly
      // when someone changes Thursday's dinner (ADR 0003).
      return isErr(result) ? EMPTY : deriveShoppingList(result.value)
    },
  })

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey })
  }

  const toggleMutation = useMutation({
    mutationFn: async ({ id, checked }: { id: IngredientId; checked: boolean }) => {
      if (weekPlanId === undefined) return
      await setChecked(client, weekPlanId, id, checked)
    },
    onSettled: invalidate,
  })

  const outOfMutation = useMutation({
    mutationFn: async (id: IngredientId) => {
      if (household === undefined) return
      await markRunningLow(client, household.id, id)
    },
    onSettled: invalidate,
  })

  const addMutation = useMutation({
    mutationFn: async (label: string) => {
      if (weekPlanId === undefined) return
      await addExtra(client, weekPlanId, label)
    },
    onSettled: invalidate,
  })

  const extraMutation = useMutation({
    mutationFn: async ({ id, checked }: { id: ExtraId; checked: boolean }) => {
      await setExtraChecked(client, id, checked)
    },
    onSettled: invalidate,
  })

  return {
    list: data ?? EMPTY,
    isLoading,
    toggle: (id, checked) => {
      toggleMutation.mutate({ id, checked })
    },
    outOf: (id) => {
      outOfMutation.mutate(id)
    },
    addItem: (label) => {
      addMutation.mutate(label)
    },
    toggleExtra: (id, checked) => {
      extraMutation.mutate({ id, checked })
    },
  }
}
