import type { SlotKey } from '@/features/household'
import type { BoardCard, CookEventId } from './types'

/** Where on the week something sits: which day, and which Slot of that day. */
export type Placement = { readonly date: string; readonly slotKey: SlotKey }

/**
 * Earlier on the week than, by day first and then by the Household's own Slot
 * order — lunch comes before dinner because the household says so, not because
 * of the word.
 */
const isBefore = (a: Placement, b: Placement, slotOrder: readonly SlotKey[]): boolean => {
  if (a.date !== b.date) return a.date < b.date
  return slotOrder.indexOf(a.slotKey) < slotOrder.indexOf(b.slotKey)
}

/**
 * A Leftover is the second sitting of a pot that has already been cooked, so
 * it cannot sit before the Cook Event it came from. The board let both halves
 * of that break: a Leftover could be carried back past its Meal, and the Meal
 * could be carried forward past its Leftovers — leaving Wednesday eating the
 * leftovers of Friday's dinner.
 *
 * Both are the same rule read from either end, so both are checked here.
 */
export const breaksLeftoverOrder = (
  move:
    | { readonly kind: 'leftover'; readonly cookEventId: CookEventId; readonly to: Placement }
    | { readonly kind: 'cook-event'; readonly cookEventId: CookEventId; readonly to: Placement },
  cards: readonly BoardCard[],
  slotOrder: readonly SlotKey[],
): boolean => {
  if (move.kind === 'leftover') {
    const parent = cards.find(
      (card) => card.kind === 'cook-event' && card.cookEvent.id === move.cookEventId,
    )
    if (parent === undefined || parent.kind !== 'cook-event') return false
    return isBefore(move.to, parent.cookEvent, slotOrder)
  }

  // Moving the Meal: it may not land after any of the sittings it feeds.
  return cards.some(
    (card) =>
      card.kind === 'leftover' &&
      card.leftover.cookEventId === move.cookEventId &&
      isBefore(card.leftover, move.to, slotOrder),
  )
}
