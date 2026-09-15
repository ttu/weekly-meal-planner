import { buildBoard } from './board'
import type { CookEvent, CookEventId, Leftover, LeftoverId, WeekStart } from './types'
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
  addedByName: 'Aino',
  addedByColour: '#5F7355',
})

describe('buildBoard', () => {
  const weekStart = '2026-08-24' as WeekStart

  it('returns seven days in order', () => {
    const board = buildBoard({ weekStart, slots, cookEvents: [], leftovers: [] })
    expect(board).toHaveLength(7)
    expect(board[0]!.date).toBe('2026-08-24')
    expect(board[6]!.date).toBe('2026-08-30')
  })

  it('gives every day the Household Slots in configured order', () => {
    const board = buildBoard({ weekStart, slots, cookEvents: [], leftovers: [] })
    expect(board[0]!.slots.map((s) => s.slotKey)).toEqual(['lunch', 'dinner'])
  })

  it('places a Cook Event in its day and Slot', () => {
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [cookEvent('c1', '2026-08-25', 'dinner')],
      leftovers: [],
    })
    expect(board[1]!.slots[1]!.cards).toHaveLength(1)
    expect(board[1]!.slots[1]!.cards[0]!.kind).toBe('cook-event')
  })

  it('keeps two Cook Events in one Slot rather than dropping either', () => {
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [
        cookEvent('c1', '2026-08-25', 'dinner'),
        cookEvent('c2', '2026-08-25', 'dinner'),
      ],
      leftovers: [],
    })
    expect(board[1]!.slots[1]!.cards).toHaveLength(2)
  })

  it("places a Leftover on its own day and Slot, not its parent's", () => {
    const leftover: Leftover = {
      id: 'l1' as LeftoverId,
      cookEventId: 'c1' as CookEventId,
      parentMealName: 'Chili con carne',
      date: '2026-08-26',
      slotKey: 'lunch' as SlotKey,
    }
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [cookEvent('c1', '2026-08-25', 'dinner')],
      leftovers: [leftover],
    })
    expect(board[2]!.slots[0]!.cards[0]!.kind).toBe('leftover')
    expect(board[1]!.slots[1]!.cards).toHaveLength(1)
  })

  // Removing a Slot from the Household config must not delete the Meals planned
  // in it (docs/03-datamodel.md), so the board tolerates an orphaned slot_key.
  it('skips a card whose Slot is no longer configured, without losing the day', () => {
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [cookEvent('c1', '2026-08-25', 'brunch')],
      leftovers: [],
    })
    expect(board[1]!.slots.flatMap((s) => s.cards)).toHaveLength(0)
    expect(board[1]!.slots).toHaveLength(2)
  })

  it('ignores a card dated outside the week', () => {
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [cookEvent('c1', '2026-09-14', 'dinner')],
      leftovers: [],
    })
    expect(board.flatMap((d) => d.slots).flatMap((s) => s.cards)).toHaveLength(0)
  })
})
