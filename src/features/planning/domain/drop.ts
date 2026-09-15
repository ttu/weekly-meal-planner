import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/shared/types/ids'
import type { BacklogItem, CookEvent, CookEventId } from './types'

/** What is being carried. A Backlog card and a planned card are both cards you
 *  can pick up, and the board should not care which one is in the air. */
export type DragPayload =
  | { readonly kind: 'backlog'; readonly item: BacklogItem }
  | { readonly kind: 'cook-event'; readonly cookEvent: CookEvent }

/** Where it can land: a Slot on the board, or the Backlog — dropping a planned
 *  Meal back on the Backlog is how it leaves the week. */
export type DropTarget =
  | { readonly kind: 'slot'; readonly date: string; readonly slotKey: SlotKey }
  | { readonly kind: 'backlog' }

/**
 * What a drop means. Each one is an action the tap path already performs, so
 * dragging is a faster way to say the same thing rather than a second way of
 * saying it.
 */
export type DropAction =
  | {
      readonly kind: 'plan'
      readonly mealId: MealId
      readonly backlogItemId: BacklogItem['id']
      readonly date: string
      readonly slotKey: SlotKey
      readonly servingsCooked: Servings
    }
  | {
      readonly kind: 'move'
      readonly cookEventId: CookEventId
      readonly date: string
      readonly slotKey: SlotKey
    }
  | { readonly kind: 'unplan'; readonly cookEventId: CookEventId }
  /** Let go somewhere that means nothing: put it back and change no data. */
  | { readonly kind: 'none' }

export const resolveDrop = (payload: DragPayload, target: DropTarget): DropAction => {
  if (target.kind === 'backlog') {
    return payload.kind === 'cook-event'
      ? { kind: 'unplan', cookEventId: payload.cookEvent.id }
      : { kind: 'none' }
  }

  if (payload.kind === 'cook-event') {
    const { cookEvent } = payload
    // Dropping a card back where it started is a cancelled drag, not an edit.
    // Writing anyway would bump the row and flash it as "just changed" for
    // everyone else on the board.
    if (cookEvent.date === target.date && cookEvent.slotKey === target.slotKey) {
      return { kind: 'none' }
    }
    return {
      kind: 'move',
      cookEventId: cookEvent.id,
      date: target.date,
      slotKey: target.slotKey,
    }
  }

  return {
    kind: 'plan',
    mealId: payload.item.mealId,
    backlogItemId: payload.item.id,
    date: target.date,
    slotKey: target.slotKey,
    servingsCooked: payload.item.servings,
  }
}
