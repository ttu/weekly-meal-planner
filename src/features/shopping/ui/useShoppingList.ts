import { useMemo } from 'react'
import { systemClock, type Clock } from '@/shared/time/clock'
import { readMembers, useBoardSession } from '@/features/household'
import { mealIndex } from '@/features/meals'
import { readWeek, useSelectedWeek } from '@/features/planning'
import { useData, useSync, useView } from '@/features/sync'
import { useWrite } from '@/shared/query/useWrite'
import type { IngredientId } from '@/shared/types/ids'
import type { Result } from '@/shared/types/result'
import {
  addExtra,
  forgetStaple,
  makeStaple,
  markRunningLow,
  readShoppingInput,
  setChecked,
  setExtraChecked,
} from '../application/shopping-data'
import { deriveShoppingList } from '../domain/derive'
import type { ExtraId, ShoppingList } from '../domain/types'

const EMPTY: ShoppingList = { sittings: 0, buy: [], cupboard: [], extras: [], incomplete: [] }

export type ShoppingListView = {
  readonly list: ShoppingList
  readonly isLoading: boolean
  /** The device has looked for its board, so an empty list really is empty. */
  readonly hasData: boolean
  /** The last change could not be saved. */
  readonly failed: boolean
  readonly toggle: (ingredientId: IngredientId, checked: boolean) => void
  readonly outOf: (ingredientId: IngredientId) => void
  readonly addItem: (label: string) => void
  readonly toggleExtra: (id: ExtraId, checked: boolean) => void
  /** "We always have this in" — moves a Buy Line into the Cupboard Check. */
  readonly keepInCupboard: (id: IngredientId) => void
  /** No longer kept in; it returns to the Buy list. */
  readonly stopKeeping: (id: IngredientId) => void
}

/**
 * The Shopping List, derived on every read and never stored (ADR 0003). A tick
 * lands in the local copy at once, so it shows in a shop with no signal and is
 * sent when there is some.
 */
export const useShoppingList = (clock: Clock = systemClock): ShoppingListView => {
  const { household, checked } = useBoardSession()
  const data = useData()
  const view = useView()
  const { deps } = useSync()
  const { weekStart } = useSelectedWeek(clock)

  const list = useMemo(() => {
    if (!household || !data || !view) return EMPTY
    const meals = mealIndex(data, household.id, household.locale)
    const members = new Map(
      readMembers(view, data).map((m) => [m.id, { name: m.displayName, colour: m.colour }]),
    )
    // A Slot that was removed hides its Meals on the board, so they are not bought for either.
    const slots = new Set(household.slots.map((s) => String(s.key)))
    const { cookEvents } = readWeek(data, weekStart, meals, members)
    const shown = cookEvents.filter((c) => slots.has(String(c.slotKey)))
    return deriveShoppingList(readShoppingInput(data, weekStart, household.locale, shown, meals))
    // `view` changes whenever the board does, which is when the rows may have.
  }, [household, data, view, weekStart])

  const write = useWrite()
  const run = (task: (d: NonNullable<typeof data>) => Promise<Result<unknown, unknown>>): void => {
    if (data) write.run(() => task(data))
  }

  return {
    list,
    isLoading: !checked,
    hasData: checked,
    failed: write.failed,
    toggle: (id, isChecked) => {
      run((d) => setChecked(d, weekStart, id, isChecked))
    },
    outOf: (id) => {
      run((d) => markRunningLow(d, id))
    },
    keepInCupboard: (id) => {
      run((d) => makeStaple(d, id))
    },
    stopKeeping: (id) => {
      run((d) => forgetStaple(d, id))
    },
    addItem: (label) => {
      if (label.trim() === '') return
      run((d) => addExtra(d, deps.random, deps.clock.now().getTime(), weekStart, label))
    },
    toggleExtra: (id, isChecked) => {
      run((d) => setExtraChecked(d, id, isChecked))
    },
  }
}
