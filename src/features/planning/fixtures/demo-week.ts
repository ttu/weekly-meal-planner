import type { Clock } from '@/shared/time/clock'
import type { Household, HouseholdId, Slot, SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import { currentWeekStart, weekDates } from '../domain/week'
import type { CookEvent, CookEventId, Leftover, LeftoverId } from '../domain/types'

const slots: readonly Slot[] = [
  { key: 'lunch' as SlotKey, labelKey: 'slot.lunch' },
  { key: 'dinner' as SlotKey, labelKey: 'slot.dinner' },
]

export const demoHousehold: Household = {
  id: 'demo-household' as HouseholdId,
  name: 'Koivisto',
  locale: 'fi',
  slots,
}

const cookEvent = (
  id: string,
  mealName: string,
  date: string,
  slotKey: string,
  servings: number,
): CookEvent => ({
  id: id as CookEventId,
  mealId: `meal-${id}` as MealId,
  mealName,
  date,
  slotKey: slotKey as SlotKey,
  servingsCooked: servings as Servings,
})

export type DemoWeek = {
  readonly cookEvents: readonly CookEvent[]
  readonly leftovers: readonly Leftover[]
}

/**
 * Clock-derived so the demo is always the *current* week — a fixture pinned to
 * a past date shows an empty board later and wastes an afternoon.
 *
 * Deliberately covers every state the board must handle: a normal day, two
 * Meals in one Slot, a Leftover, and empty Slots.
 *
 * Replaced by the Postgres repository in Task 7.
 */
export const demoWeek = (clock: Clock): DemoWeek => {
  const days = weekDates(currentWeekStart(clock))
  const [monday, tuesday, wednesday] = [days[0]!, days[1]!, days[2]!]

  const chili = cookEvent('c1', 'Chili con carne', monday, 'dinner', 6)

  return {
    cookEvents: [
      cookEvent('c0', 'Munavoileivät', monday, 'lunch', 2),
      chili,
      cookEvent('c2', 'Uunilohi ja perunamuusi', tuesday, 'dinner', 3),
      cookEvent('c3', 'Tacos', tuesday, 'dinner', 2),
    ],
    leftovers: [
      {
        id: 'l1' as LeftoverId,
        cookEventId: chili.id,
        parentMealName: chili.mealName,
        date: wednesday,
        slotKey: 'lunch' as SlotKey,
      },
    ],
  }
}
