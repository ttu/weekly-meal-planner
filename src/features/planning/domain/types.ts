import type { Brand } from '@/shared/types/brand'
import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'

export type WeekStart = Brand<string, 'WeekStart'>
export type WeekPlanId = Brand<string, 'WeekPlanId'>
export type CookEventId = Brand<string, 'CookEventId'>
export type LeftoverId = Brand<string, 'LeftoverId'>
export type BacklogItemId = Brand<string, 'BacklogItemId'>

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

export type BoardCard =
  | { readonly kind: 'cook-event'; readonly cookEvent: CookEvent }
  | { readonly kind: 'leftover'; readonly leftover: Leftover }
