import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { err, ok, type Result } from '@/shared/types/result'
import type { IngredientId } from '@/shared/types/ids'
import { catalogueIngredients, type MealDetail } from '@/features/meals'
import type { CookEvent } from '@/features/planning'
import { newId, type Data, type Random } from '@/features/sync'
import type { Locale } from '@/shared/i18n'
import type { DeriveInput } from '../domain/derive'
import type { ExtraId } from '../domain/types'

/**
 * The Shopping List's inputs, as rows of the synced board. The list itself is
 * never stored (ADR 0003): these rows are only what people said about it.
 *
 *   check:<week>:<ingredient>     week, ingredientId, checked
 *   staple:<ingredient>           ingredientId, runningLow          (kept in the cupboard)
 *   extra:<id>                    week, label, checked, createdAt
 *   override:<week>:<ingredient>  week, ingredientId, quantity, unit, reason?
 */
export type ShoppingWriteError = 'write-failed'

const checkRow = z.object({ week: z.string(), ingredientId: z.string(), checked: z.boolean() })
const stapleRow = z.object({ ingredientId: z.string(), runningLow: z.boolean().catch(false) })
const extraRow = z.object({
  week: z.string(),
  label: z.string().min(1),
  checked: z.boolean().catch(false),
  createdAt: z.number().catch(0),
})
const overrideRow = z.object({
  week: z.string(),
  ingredientId: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  reason: z.string().optional(),
})

/** One read of everything the pure derivation needs. */
export const readShoppingInput = (
  data: Data,
  week: string,
  locale: Locale,
  plannedEvents: readonly CookEvent[],
  meals: ReadonlyMap<string, MealDetail>,
): DeriveInput => {
  const known = plannedEvents.flatMap((e) => {
    const meal = meals.get(e.mealId)
    return meal ? [{ event: e, meal }] : []
  })
  // One row per Meal and Ingredient, however many times the Meal is planned:
  // the derivation walks the Meal once per Cook Event and multiplies, so the
  // recipe must not arrive twice.
  const distinct = new Map(known.map(({ meal }) => [String(meal.id), meal]))

  return {
    plannedMeals: known.map(({ event, meal }) => ({
      mealId: meal.id,
      mealName: meal.name,
      mealServings: meal.servings,
      servingsCooked: event.servingsCooked,
    })),
    mealIngredients: [...distinct.values()].flatMap((meal) =>
      meal.ingredients.map((i) => ({
        mealId: meal.id,
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
      })),
    ),
    ingredients: catalogueIngredients(locale).map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      dimension: i.dimension,
      baseUnit: i.baseUnit,
    })),
    staples: data.list('staple').flatMap(({ doc }) => {
      const row = stapleRow.safeParse(doc)
      return row.success
        ? [
            {
              ingredientId: brand<string, 'IngredientId'>(row.data.ingredientId),
              runningLow: row.data.runningLow,
            },
          ]
        : []
    }),
    overrides: data.list('override').flatMap(({ doc }) => {
      const row = overrideRow.safeParse(doc)
      if (!row.success || row.data.week !== week) return []
      return [
        {
          ingredientId: brand<string, 'IngredientId'>(row.data.ingredientId),
          quantity: brand<number, 'Quantity'>(row.data.quantity),
          unit: row.data.unit,
          ...(row.data.reason === undefined ? {} : { reason: row.data.reason }),
        },
      ]
    }),
    extras: data
      .list('extra')
      .flatMap(({ id, doc }) => {
        const row = extraRow.safeParse(doc)
        return row.success && row.data.week === week ? [{ id, row: row.data }] : []
      })
      .sort((a, b) => a.row.createdAt - b.row.createdAt || a.id.localeCompare(b.id))
      .map(({ id, row }) => ({
        id: brand<string, 'ExtraId'>(id),
        label: row.label,
        checked: row.checked,
      })),
    checkedIngredientIds: data.list('check').flatMap(({ doc }) => {
      const row = checkRow.safeParse(doc)
      return row.success && row.data.week === week && row.data.checked
        ? [brand<string, 'IngredientId'>(row.data.ingredientId)]
        : []
    }),
  }
}

const attempt = async (write: () => Promise<void>): Promise<Result<void, ShoppingWriteError>> => {
  try {
    await write()
    return ok(undefined)
  } catch {
    return err('write-failed')
  }
}

export const setChecked = (
  data: Data,
  week: string,
  ingredientId: IngredientId,
  checked: boolean,
): Promise<Result<void, ShoppingWriteError>> =>
  attempt(() => data.put('check', `${week}:${ingredientId}`, { week, ingredientId, checked }))

/** Marks a Staple as running low, which promotes it onto the Buy list. */
export const markRunningLow = (
  data: Data,
  ingredientId: IngredientId,
): Promise<Result<void, ShoppingWriteError>> =>
  attempt(() => data.put('staple', ingredientId, { ingredientId, runningLow: true }))

/**
 * "We always have this in." The Ingredient leaves the Buy list and joins the
 * Cupboard Check, where it waits to be declared run out.
 */
export const makeStaple = (
  data: Data,
  ingredientId: IngredientId,
): Promise<Result<void, ShoppingWriteError>> =>
  attempt(() => data.put('staple', ingredientId, { ingredientId, runningLow: false }))

/** No longer something the household keeps in; it goes back on the Buy list. */
export const forgetStaple = (
  data: Data,
  ingredientId: IngredientId,
): Promise<Result<void, ShoppingWriteError>> => attempt(() => data.remove('staple', ingredientId))

const MAX_EXTRAS_PER_WEEK = 100

export const addExtra = async (
  data: Data,
  random: Random,
  now: number,
  week: string,
  label: string,
): Promise<Result<ExtraId, ShoppingWriteError>> => {
  const trimmed = label.trim()
  if (trimmed.length === 0) return err('write-failed')
  if (data.list('extra').filter(({ doc }) => doc.week === week).length >= MAX_EXTRAS_PER_WEEK) {
    return err('write-failed')
  }
  const id = newId(random)
  const written = await attempt(() =>
    data.put('extra', id, { week, label: trimmed, checked: false, createdAt: now }),
  )
  return written.kind === 'err' ? written : ok(brand<string, 'ExtraId'>(id))
}

export const setExtraChecked = (
  data: Data,
  id: ExtraId,
  checked: boolean,
): Promise<Result<void, ShoppingWriteError>> => attempt(() => data.put('extra', id, { checked }))
