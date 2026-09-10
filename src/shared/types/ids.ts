import type { Brand } from './brand'

/**
 * The glossary's identifiers, in one place. They are cross-feature vocabulary —
 * `planning` and `shopping` both speak of a MealId — and duplicating the brand
 * in each feature would make two nominally identical types that are actually
 * the same, which is confusing rather than safe.
 *
 * Brands are structural on the tag, so a feature may still re-export these from
 * its barrel for readability.
 */
export type HouseholdId = Brand<string, 'HouseholdId'>
export type MemberId = Brand<string, 'MemberId'>
export type SlotKey = Brand<string, 'SlotKey'>
export type MealId = Brand<string, 'MealId'>
export type IngredientId = Brand<string, 'IngredientId'>
export type IngredientSlug = Brand<string, 'IngredientSlug'>
export type WeekPlanId = Brand<string, 'WeekPlanId'>
export type CookEventId = Brand<string, 'CookEventId'>
export type LeftoverId = Brand<string, 'LeftoverId'>
export type BacklogItemId = Brand<string, 'BacklogItemId'>
export type WeekStart = Brand<string, 'WeekStart'>

/**
 * Quantities are branded for the same reason ids are: `scale(quantity, servings)`
 * taking two bare numbers is the bug that puts four kilos of onions on a list.
 */
export type Servings = Brand<number, 'Servings'>
export type Quantity = Brand<number, 'Quantity'>
