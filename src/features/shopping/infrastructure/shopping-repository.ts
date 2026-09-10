import { z } from 'zod'
import { brand } from '@/shared/types/brand'
import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '@/features/household'
import type { Locale } from '@/shared/i18n'
import type { DeriveInput } from '../domain/derive'

const cookEventRow = z.object({
  meal_id: z.uuid(),
  servings_cooked: z.number().int(),
  meal: z.object({
    name: z.string(),
    servings: z.number().int(),
    meal_ingredient: z.array(
      z.object({ ingredient_id: z.uuid(), quantity: z.number(), unit: z.string() }),
    ),
  }),
})

const ingredientRow = z.object({
  id: z.uuid(),
  category: z.string(),
  dimension: z.enum(['mass', 'volume', 'count']),
  base_unit: z.string(),
  ingredient_name: z.array(z.object({ locale: z.enum(['fi', 'en']), name: z.string() })),
})

const stapleRow = z.object({ ingredient_id: z.uuid(), running_low: z.boolean() })
const checkRow = z.object({ ingredient_id: z.uuid() })
const overrideRow = z.object({
  ingredient_id: z.uuid(),
  quantity: z.number(),
  unit: z.string(),
  reason: z.string().nullable(),
})
const extraRow = z.object({
  id: z.uuid(),
  label: z.string(),
  checked_at: z.string().nullable(),
})

export type LoadShoppingError = 'invalid-row'

/**
 * Everything the pure derivation needs, in one read. The derivation itself
 * touches no IO (ADR 0003), so this is the only place shape can go wrong.
 */
export const loadShoppingData = async (
  client: AppSupabaseClient,
  weekPlanId: string,
  locale: Locale,
): Promise<Result<DeriveInput, LoadShoppingError>> => {
  const [
    { data: cookEvents },
    { data: ingredients },
    { data: staples },
    { data: checks },
    { data: overrides },
    { data: extras },
  ] = await Promise.all([
    client
      .from('cook_event')
      .select(
        'meal_id,servings_cooked,meal(name,servings,meal_ingredient(ingredient_id,quantity,unit))',
      )
      .eq('week_plan_id', weekPlanId),
    client
      .from('ingredient')
      .select('id,category,dimension,base_unit,ingredient_name(locale,name)'),
    client.from('household_staple').select('ingredient_id,running_low'),
    client.from('shopping_check').select('ingredient_id').eq('week_plan_id', weekPlanId),
    client
      .from('shopping_override')
      .select('ingredient_id,quantity,unit,reason')
      .eq('week_plan_id', weekPlanId),
    client
      .from('shopping_extra')
      .select('id,label,checked_at')
      .eq('week_plan_id', weekPlanId)
      .order('created_at', { ascending: true }),
  ])

  const parsedEvents = z.array(cookEventRow).safeParse(cookEvents ?? [])
  const parsedIngredients = z.array(ingredientRow).safeParse(ingredients ?? [])
  const parsedStaples = z.array(stapleRow).safeParse(staples ?? [])
  const parsedChecks = z.array(checkRow).safeParse(checks ?? [])
  const parsedOverrides = z.array(overrideRow).safeParse(overrides ?? [])
  const parsedExtras = z.array(extraRow).safeParse(extras ?? [])

  if (
    !parsedEvents.success ||
    !parsedIngredients.success ||
    !parsedStaples.success ||
    !parsedChecks.success ||
    !parsedOverrides.success ||
    !parsedExtras.success
  ) {
    return err('invalid-row')
  }

  return ok({
    plannedMeals: parsedEvents.data.map((e) => ({
      mealId: brand<string, 'MealId'>(e.meal_id),
      mealName: e.meal.name,
      mealServings: brand<number, 'Servings'>(e.meal.servings),
      servingsCooked: brand<number, 'Servings'>(e.servings_cooked),
    })),
    mealIngredients: parsedEvents.data.flatMap((e) =>
      e.meal.meal_ingredient.map((mi) => ({
        mealId: brand<string, 'MealId'>(e.meal_id),
        ingredientId: brand<string, 'IngredientId'>(mi.ingredient_id),
        quantity: brand<number, 'Quantity'>(mi.quantity),
        unit: mi.unit,
      })),
    ),
    ingredients: parsedIngredients.data.map((i) => ({
      id: brand<string, 'IngredientId'>(i.id),
      name:
        i.ingredient_name.find((n) => n.locale === locale)?.name ??
        i.ingredient_name[0]?.name ??
        '',
      category: i.category,
      dimension: i.dimension,
      baseUnit: i.base_unit,
    })),
    staples: parsedStaples.data.map((s) => ({
      ingredientId: brand<string, 'IngredientId'>(s.ingredient_id),
      runningLow: s.running_low,
    })),
    overrides: parsedOverrides.data.map((o) => ({
      ingredientId: brand<string, 'IngredientId'>(o.ingredient_id),
      quantity: brand<number, 'Quantity'>(o.quantity),
      unit: o.unit,
      ...(o.reason === null ? {} : { reason: o.reason }),
    })),
    extras: parsedExtras.data.map((e) => ({
      id: brand<string, 'ExtraId'>(e.id),
      label: e.label,
      checked: e.checked_at !== null,
    })),
    checkedIngredientIds: parsedChecks.data.map((c) =>
      brand<string, 'IngredientId'>(c.ingredient_id),
    ),
  })
}
