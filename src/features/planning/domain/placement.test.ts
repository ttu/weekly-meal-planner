import { describePlacement } from './placement'
import { buildBoard } from './board'
import type { CookEvent, CookEventId, WeekStart } from './types'
import type { Slot, SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'

const slots: readonly Slot[] = [
  { key: 'lunch' as SlotKey, labelKey: 'slot.lunch' },
  { key: 'dinner' as SlotKey, labelKey: 'slot.dinner' },
]

const cookEvent = (id: string, date: string, slotKey: string): CookEvent => ({
  id: id as CookEventId,
  mealId: 'm1' as MealId,
  mealName: 'Chili con carne',
  date,
  slotKey: slotKey as SlotKey,
  servingsCooked: 6 as Servings,
})

const weekStart = '2026-09-07' as WeekStart

const boardWith = (cookEvents: readonly CookEvent[]) =>
  buildBoard({ weekStart, slots, cookEvents, leftovers: [] })

describe('describePlacement', () => {
  it('reports an empty Slot as taking nothing', () => {
    const result = describePlacement({
      board: boardWith([]),
      date: '2026-09-08',
      slotKey: 'dinner' as SlotKey,
    })
    expect(result).toEqual({ existingCount: 0, willJoinExisting: false })
  })

  // The app never refuses an edit; it says what will happen instead.
  it('reports that a Meal will join the ones already there', () => {
    const result = describePlacement({
      board: boardWith([
        cookEvent('c1', '2026-09-08', 'dinner'),
        cookEvent('c2', '2026-09-08', 'dinner'),
      ]),
      date: '2026-09-08',
      slotKey: 'dinner' as SlotKey,
    })
    expect(result).toEqual({ existingCount: 2, willJoinExisting: true })
  })

  it('counts only the chosen Slot', () => {
    const result = describePlacement({
      board: boardWith([cookEvent('c1', '2026-09-08', 'lunch')]),
      date: '2026-09-08',
      slotKey: 'dinner' as SlotKey,
    })
    expect(result.existingCount).toBe(0)
  })

  it('counts only the chosen day', () => {
    const result = describePlacement({
      board: boardWith([cookEvent('c1', '2026-09-09', 'dinner')]),
      date: '2026-09-08',
      slotKey: 'dinner' as SlotKey,
    })
    expect(result.existingCount).toBe(0)
  })

  it('reports zero for a Slot the Household no longer has, rather than throwing', () => {
    const result = describePlacement({
      board: boardWith([]),
      date: '2026-09-08',
      slotKey: 'brunch' as SlotKey,
    })
    expect(result).toEqual({ existingCount: 0, willJoinExisting: false })
  })

  it('reports zero for a date outside the week', () => {
    const result = describePlacement({
      board: boardWith([]),
      date: '2026-12-24',
      slotKey: 'dinner' as SlotKey,
    })
    expect(result.existingCount).toBe(0)
  })
})
