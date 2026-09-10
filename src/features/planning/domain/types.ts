import type {
  BacklogItemId,
  CookEventId,
  LeftoverId,
  MealId,
  Servings,
  SlotKey,
} from '@/shared/types/ids'

export type {
  BacklogItemId,
  CookEventId,
  LeftoverId,
  WeekPlanId,
  WeekStart,
} from '@/shared/types/ids'

/** The only thing that contributes Ingredients to a Shopping List. */
export type CookEvent = {
  readonly id: CookEventId
  readonly mealId: MealId
  readonly mealName: string
  readonly date: string
  readonly slotKey: SlotKey
  readonly servingsCooked: Servings
}

/** Borrows its Meal and its Servings from its Cook Event, and contributes
 *  nothing to a Shopping List (ADR 0004). */
export type Leftover = {
  readonly id: LeftoverId
  readonly cookEventId: CookEventId
  readonly parentMealName: string
  readonly date: string
  readonly slotKey: SlotKey
}

/**
 * A Meal wanted this week, not yet dated. `addedByName` and `addedByColour` are
 * denormalised from household_member at read time: who wanted it is the point
 * of the card, and the design puts it on the card rather than in a tooltip.
 */
export type BacklogItem = {
  readonly id: BacklogItemId
  readonly mealId: MealId
  readonly mealName: string
  readonly servings: Servings
  readonly addedByName: string
  readonly addedByColour: string
}

export type BoardCard =
  | { readonly kind: 'cook-event'; readonly cookEvent: CookEvent }
  | { readonly kind: 'leftover'; readonly leftover: Leftover }
