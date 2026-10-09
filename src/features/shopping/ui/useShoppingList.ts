import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import { useSelectedWeek, useWeekBoard } from '@/features/planning'
import type { IngredientId } from '@/shared/types/ids'
import { loadShoppingData } from '../infrastructure/shopping-repository'
import { deriveShoppingList } from '../domain/derive'
import {
  addExtra,
  forgetStaple,
  makeStaple,
  markRunningLow,
  setChecked,
  setExtraChecked,
} from '../application/shopping-writes'
import { brand } from '@/shared/types/brand'
import type { Extra, ExtraId, ShoppingList } from '../domain/types'

const EMPTY: ShoppingList = { sittings: 0, buy: [], cupboard: [], extras: [], incomplete: [] }

export type ShoppingListView = {
  readonly list: ShoppingList
  readonly isLoading: boolean
  readonly toggle: (ingredientId: IngredientId, checked: boolean) => void
  readonly outOf: (ingredientId: IngredientId) => void
  readonly addItem: (label: string) => void
  readonly toggleExtra: (id: ExtraId, checked: boolean) => void
  /** "We always have this in" — moves a Buy Line into the Cupboard Check. */
  readonly keepInCupboard: (id: IngredientId) => void
  /** No longer kept in; it returns to the Buy list. */
  readonly stopKeeping: (id: IngredientId) => void
}

export const useShoppingList = (clock: Clock = systemClock): ShoppingListView => {
  const { client, household } = useSession()
  const { weekPlanId } = useWeekBoard(clock)
  const queryClient = useQueryClient()
  const { weekStart } = useSelectedWeek(clock)
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

  /**
   * Ticking is local-first (docs/01-functional-spec.md): the row changes on the
   * tap, not on the round trip. A shop is where this list is used and a shop is
   * where the signal goes — without this the tap looks ignored, so it gets
   * repeated, and both taps land when the connection comes back.
   *
   * Every one of these cancels in-flight refetches first, so a response that
   * was already on its way cannot overwrite what was just tapped.
   */
  const optimistically = async (
    change: (list: ShoppingList) => ShoppingList,
  ): Promise<ShoppingList | undefined> => {
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData<ShoppingList>(queryKey)
    if (previous !== undefined) queryClient.setQueryData(queryKey, change(previous))
    return previous
  }

  const rollBack = (previous: ShoppingList | undefined): void => {
    if (previous !== undefined) queryClient.setQueryData(queryKey, previous)
  }

  const toggleMutation = useMutation({
    mutationFn: async ({ id, checked }: { id: IngredientId; checked: boolean }) => {
      if (weekPlanId === undefined) return
      await setChecked(client, weekPlanId, id, checked)
    },
    onMutate: async ({ id, checked }) =>
      await optimistically((list) => ({
        ...list,
        buy: list.buy.map((line) => (line.ingredientId === id ? { ...line, checked } : line)),
      })),
    onError: (_error, _variables, previous) => {
      rollBack(previous)
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

  const stapleMutation = useMutation({
    mutationFn: async ({ id, keep }: { id: IngredientId; keep: boolean }) => {
      if (household === undefined) return
      await (keep ? makeStaple : forgetStaple)(client, household.id, id)
    },
    onSettled: invalidate,
  })

  const addMutation = useMutation({
    mutationFn: async (label: string) => {
      if (weekPlanId === undefined) return
      await addExtra(client, weekPlanId, label)
    },
    // The real row arrives with the refetch and replaces this one. Until then
    // the Extra is on the list, which is the point of writing it down.
    onMutate: async (label) =>
      await optimistically((list) => ({
        ...list,
        extras: [
          ...list.extras,
          { id: brand<string, 'ExtraId'>(`pending-${String(Date.now())}`), label, checked: false },
        ],
      })),
    onError: (_error, _variables, previous) => {
      rollBack(previous)
    },
    onSettled: invalidate,
  })

  const extraMutation = useMutation({
    mutationFn: async ({ id, checked }: { id: ExtraId; checked: boolean }) => {
      await setExtraChecked(client, id, checked)
    },
    onMutate: async ({ id, checked }) =>
      await optimistically((list) => ({
        ...list,
        extras: list.extras.map((e: Extra) => (e.id === id ? { ...e, checked } : e)),
      })),
    onError: (_error, _variables, previous) => {
      rollBack(previous)
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
    keepInCupboard: (id) => {
      stapleMutation.mutate({ id, keep: true })
    },
    stopKeeping: (id) => {
      stapleMutation.mutate({ id, keep: false })
    },
    addItem: (label) => {
      addMutation.mutate(label)
    },
    toggleExtra: (id, checked) => {
      extraMutation.mutate({ id, checked })
    },
  }
}
