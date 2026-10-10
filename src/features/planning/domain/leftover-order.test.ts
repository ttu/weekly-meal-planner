import { breaksLeftoverOrder } from './leftover-order'
import type { BoardCard } from './types'
import type { SlotKey } from '@/features/household'
import type { CookEventId, LeftoverId, MealId, Servings } from '@/shared/types/ids'

const slots = ['lunch', 'dinner'] as unknown as readonly SlotKey[]
const slot = (key: string): SlotKey => key as unknown as SlotKey

const cookEvent = (date: string, slotKey: string): BoardCard => ({
  kind: 'cook-event',
  cookEvent: {
    id: 'ce1' as CookEventId,
    mealId: 'm1' as MealId,
    mealName: 'Chili con carne',
    date,
    slotKey: slot(slotKey),
    servingsCooked: 4 as Servings,
    addedByName: 'Aino',
    addedByColour: '#5F7355',
  },
})

const leftover = (date: string, slotKey: string): BoardCard => ({
  kind: 'leftover',
  leftover: {
    id: 'lo1' as LeftoverId,
    cookEventId: 'ce1' as CookEventId,
    parentMealName: 'Chili con carne',
    date,
    slotKey: slot(slotKey),
  },
})

describe('breaksLeftoverOrder', () => {
  describe('carrying a Leftover', () => {
    const cards = [cookEvent('2026-10-07', 'dinner')]

    it('allows a later day', () => {
      const move = {
        kind: 'leftover',
        cookEventId: 'ce1' as CookEventId,
        to: { date: '2026-10-08', slotKey: slot('lunch') },
      } as const
      expect(breaksLeftoverOrder(move, cards, slots)).toBe(false)
    })

    it('refuses an earlier day', () => {
      const move = {
        kind: 'leftover',
        cookEventId: 'ce1' as CookEventId,
        to: { date: '2026-10-06', slotKey: slot('dinner') },
      } as const
      expect(breaksLeftoverOrder(move, cards, slots)).toBe(true)
    })

    // Lunch is before dinner because the Household put it there, so the same
    // day is not automatically safe.
    it('refuses an earlier Slot on the same day', () => {
      const move = {
        kind: 'leftover',
        cookEventId: 'ce1' as CookEventId,
        to: { date: '2026-10-07', slotKey: slot('lunch') },
      } as const
      expect(breaksLeftoverOrder(move, cards, slots)).toBe(true)
    })

    it('allows the same Slot as the Meal — a second helping that evening', () => {
      const move = {
        kind: 'leftover',
        cookEventId: 'ce1' as CookEventId,
        to: { date: '2026-10-07', slotKey: slot('dinner') },
      } as const
      expect(breaksLeftoverOrder(move, cards, slots)).toBe(false)
    })
  })

  describe('carrying the Meal', () => {
    const cards = [cookEvent('2026-10-05', 'dinner'), leftover('2026-10-07', 'lunch')]

    it('allows a move that stays before its Leftovers', () => {
      const move = {
        kind: 'cook-event',
        cookEventId: 'ce1' as CookEventId,
        to: { date: '2026-10-06', slotKey: slot('dinner') },
      } as const
      expect(breaksLeftoverOrder(move, cards, slots)).toBe(false)
    })

    /** Friday's dinner cannot be what Wednesday had the leftovers of. */
    it('refuses a move past its own Leftovers', () => {
      const move = {
        kind: 'cook-event',
        cookEventId: 'ce1' as CookEventId,
        to: { date: '2026-10-09', slotKey: slot('dinner') },
      } as const
      expect(breaksLeftoverOrder(move, cards, slots)).toBe(true)
    })

    it('ignores Leftovers of other Meals', () => {
      const move = {
        kind: 'cook-event',
        cookEventId: 'other' as CookEventId,
        to: { date: '2026-10-09', slotKey: slot('dinner') },
      } as const
      expect(breaksLeftoverOrder(move, cards, slots)).toBe(false)
    })
  })
})
