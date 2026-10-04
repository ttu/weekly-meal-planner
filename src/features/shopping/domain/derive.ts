import { isOk } from '@/shared/types/result'
import { brand } from '@/shared/types/brand'
import type { IngredientId, Quantity } from '@/shared/types/ids'
import { convert, canConvert } from './convert'
import type {
  Amount,
  BuyLine,
  Contribution,
  CupboardLine,
  Extra,
  IncompleteMealLine,
  IngredientInfo,
  MealIngredient,
  Override,
  PlannedMeal,
  ShoppingList,
  Staple,
} from './types'

export type DeriveInput = {
  /** Cook Events only. Leftovers are absent by construction: they are already
   *  paid for by their Cook Event (ADR 0004). */
  readonly plannedMeals: readonly PlannedMeal[]
  readonly mealIngredients: readonly MealIngredient[]
  readonly ingredients: readonly IngredientInfo[]
  readonly staples: readonly Staple[]
  readonly overrides: readonly Override[]
  readonly extras: readonly Extra[]
  readonly checkedIngredientIds: readonly IngredientId[]
}

type Accumulated = {
  readonly ingredientId: IngredientId
  amounts: Amount[]
  contributions: Contribution[]
}

/** Adds an amount to the group it can be summed with, or starts a new group.
 *  Mixed dimensions stay separate — "flour: 500 g + 2 tbsp" — because guessing
 *  a gram weight for a tablespoon is how a list quietly becomes wrong. */
const addAmount = (amounts: Amount[], quantity: Quantity, unit: string): void => {
  const existing = amounts.find((a) => canConvert(unit, a.unit))
  if (existing === undefined) {
    amounts.push({ quantity, unit })
    return
  }

  const converted = convert(quantity, unit, existing.unit)
  if (!isOk(converted)) {
    amounts.push({ quantity, unit })
    return
  }

  const index = amounts.indexOf(existing)
  amounts[index] = {
    quantity: brand<number, 'Quantity'>(existing.quantity + converted.value),
    unit: existing.unit,
  }
}

const round = (value: number): number => Math.round(value * 100) / 100

type Totals = {
  readonly byIngredient: ReadonlyMap<IngredientId, Accumulated>
  readonly incomplete: readonly IncompleteMealLine[]
}

/**
 * Sums what the week's Cook Events need, per Ingredient, and collects the
 * Meals that could not contribute because nobody has listed their Ingredients.
 */
const accumulate = (
  plannedMeals: readonly PlannedMeal[],
  mealIngredients: readonly MealIngredient[],
): Totals => {
  const byIngredient = new Map<IngredientId, Accumulated>()
  const incomplete: IncompleteMealLine[] = []

  for (const planned of plannedMeals) {
    const rows = mealIngredients.filter((mi) => mi.mealId === planned.mealId)

    if (rows.length === 0) {
      if (!incomplete.some((i) => i.mealId === planned.mealId)) {
        incomplete.push({ mealId: planned.mealId, mealName: planned.mealName })
      }
      continue
    }

    // Scaling by how many are actually being cooked, not by the recipe's own
    // yield: "Cooking 6" of a Meal that serves 4 needs one and a half times.
    const scale = planned.mealServings === 0 ? 1 : planned.servingsCooked / planned.mealServings

    for (const row of rows) {
      const scaled = brand<number, 'Quantity'>(round(row.quantity * scale))
      const entry = byIngredient.get(row.ingredientId) ?? {
        ingredientId: row.ingredientId,
        amounts: [],
        contributions: [],
      }
      addAmount(entry.amounts, scaled, row.unit)
      entry.contributions.push({
        mealName: planned.mealName,
        quantity: scaled,
        unit: row.unit,
      })
      byIngredient.set(row.ingredientId, entry)
    }
  }

  return { byIngredient, incomplete }
}

/** An Override replaces the derived amount outright — someone has decided what
 *  to buy, and the arithmetic does not get a second opinion. */
const buyAmounts = (entry: Accumulated, override: Override | undefined): readonly Amount[] =>
  override === undefined
    ? entry.amounts.map((a) => ({ ...a, quantity: brand<number, 'Quantity'>(round(a.quantity)) }))
    : [{ quantity: override.quantity, unit: override.unit }]

const byCategoryThenName = (
  a: { readonly category: string; readonly name: string },
  b: { readonly category: string; readonly name: string },
): number => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)

export const deriveShoppingList = ({
  plannedMeals,
  mealIngredients,
  ingredients,
  staples,
  overrides,
  extras,
  checkedIngredientIds,
}: DeriveInput): ShoppingList => {
  const infoById = new Map(ingredients.map((i) => [i.id, i]))
  const stapleById = new Map(staples.map((s) => [s.ingredientId, s]))
  const overrideById = new Map(overrides.map((o) => [o.ingredientId, o]))
  const checked = new Set(checkedIngredientIds)

  const { byIngredient, incomplete } = accumulate(plannedMeals, mealIngredients)

  const buy: BuyLine[] = []
  const cupboard: CupboardLine[] = []

  for (const entry of byIngredient.values()) {
    const info = infoById.get(entry.ingredientId)
    if (info === undefined) continue

    const staple = stapleById.get(entry.ingredientId)
    const isStaple = staple !== undefined
    const runningLow = staple?.runningLow ?? false

    // A Staple is kept off the Buy list until someone says it is running low.
    if (isStaple && !runningLow) {
      cupboard.push({ ingredientId: info.id, name: info.name, category: info.category })
      continue
    }

    const override = overrideById.get(entry.ingredientId)

    buy.push({
      ingredientId: info.id,
      name: info.name,
      category: info.category,
      amounts: buyAmounts(entry, override),
      contributions: entry.contributions,
      isOverridden: override !== undefined,
      ...(override?.reason === undefined ? {} : { overrideReason: override.reason }),
      promotedFromCupboard: isStaple && runningLow,
      checked: checked.has(info.id),
    })
  }

  // Grouped by category so the list follows the shop, not the recipes.
  buy.sort(byCategoryThenName)
  cupboard.sort(byCategoryThenName)

  return { sittings: plannedMeals.length, buy, cupboard, extras, incomplete }
}
