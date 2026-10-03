import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/shared/types/ids'
import type { BacklogItem, CookEvent, CookEventId, Leftover, LeftoverId } from './types'

/** A Meal as the library offers it: not yet wanted, not yet dated. */
export type LibraryMeal = {
  readonly id: MealId
  readonly name: string
  readonly servings: Servings
}

/** What is being carried. A Backlog card and a planned card are both cards you
 *  can pick up, and the board should not care which one is in the air. */
export type DragPayload =
  | { readonly kind: 'backlog'; readonly item: BacklogItem }
  | { readonly kind: 'cook-event'; readonly cookEvent: CookEvent }
  | { readonly kind: 'leftover'; readonly leftover: Leftover }
  | { readonly kind: 'library'; readonly meal: LibraryMeal }

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
  | { readonly kind: 'want'; readonly mealId: MealId }
  | {
      readonly kind: 'plan'
      readonly mealId: MealId
      readonly backlogItemId?: BacklogItem['id']
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
  | {
      readonly kind: 'move-leftover'
      readonly leftoverId: LeftoverId
      readonly date: string
      readonly slotKey: SlotKey
    }
  | { readonly kind: 'unplan'; readonly cookEventId: CookEventId }
  /** Let go somewhere that means nothing: put it back and change no data. */
  | { readonly kind: 'none' }

export const resolveDrop = (payload: DragPayload, target: DropTarget): DropAction => {
  if (target.kind === 'backlog') {
    // A Cook Event goes back to the Backlog, where it can be planned again. A
    // Leftover cannot: it is not a Meal anyone wants this week, it is a second
    // sitting of one already cooked, and there is nothing to put there. Use the
    // card's own remove instead.
    if (payload.kind === 'cook-event') {
      return { kind: 'unplan', cookEventId: payload.cookEvent.id }
    }
    // Carried out of the library, which is how a Meal becomes wanted.
    if (payload.kind === 'library') return { kind: 'want', mealId: payload.meal.id }
    return { kind: 'none' }
  }

  // Straight from the library onto a day: the Backlog is a staging post, not a
  // toll gate.
  if (payload.kind === 'library') {
    return {
      kind: 'plan',
      mealId: payload.meal.id,
      date: target.date,
      slotKey: target.slotKey,
      servingsCooked: payload.meal.servings,
    }
  }

  if (payload.kind === 'leftover') {
    const { leftover } = payload
    if (leftover.date === target.date && leftover.slotKey === target.slotKey) {
      return { kind: 'none' }
    }
    return {
      kind: 'move-leftover',
      leftoverId: leftover.id,
      date: target.date,
      slotKey: target.slotKey,
    }
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
