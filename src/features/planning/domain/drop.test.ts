import { brand } from '@/shared/types/brand'
import { resolveDrop, type DropTarget } from './drop'
import type { BacklogItem, CookEvent } from './types'

const slot = (date: string, slotKey: string): DropTarget => ({
  kind: 'slot',
  date,
  slotKey: brand<string, 'SlotKey'>(slotKey),
})

const backlogItem: BacklogItem = {
  id: brand<string, 'BacklogItemId'>('b1'),
  mealId: brand<string, 'MealId'>('m1'),
  mealName: 'Chili con carne',
  servings: brand<number, 'Servings'>(4),
  addedByName: 'Aino',
  addedByColour: '#5F7355',
}

const cookEvent: CookEvent = {
  id: brand<string, 'CookEventId'>('c1'),
  mealId: brand<string, 'MealId'>('m1'),
  mealName: 'Chili con carne',
  date: '2026-09-14',
  slotKey: brand<string, 'SlotKey'>('dinner'),
  servingsCooked: brand<number, 'Servings'>(6),
  addedByName: 'Aino',
  addedByColour: '#5F7355',
}

describe('resolveDrop', () => {
  it('plans a Backlog Item dropped on a Slot, keeping the Meal servings', () => {
    const action = resolveDrop({ kind: 'backlog', item: backlogItem }, slot('2026-09-16', 'lunch'))

    expect(action).toEqual({
      kind: 'plan',
      mealId: 'm1',
      backlogItemId: 'b1',
      date: '2026-09-16',
      slotKey: 'lunch',
      servingsCooked: 4,
    })
  })

  it('moves a planned Meal dropped on another Slot', () => {
    const action = resolveDrop({ kind: 'cook-event', cookEvent }, slot('2026-09-16', 'lunch'))

    expect(action).toEqual({
      kind: 'move',
      cookEventId: 'c1',
      date: '2026-09-16',
      slotKey: 'lunch',
    })
  })

  // A drag that ends where it started is a cancelled drag. Writing anyway would
  // flash the day as "just changed" on everyone else's board for no reason.
  it('does nothing when a planned Meal is dropped back where it was', () => {
    const action = resolveDrop({ kind: 'cook-event', cookEvent }, slot('2026-09-14', 'dinner'))

    expect(action).toEqual({ kind: 'none' })
  })

  it('takes a planned Meal off the week when it is dropped on the Backlog', () => {
    const action = resolveDrop({ kind: 'cook-event', cookEvent }, { kind: 'backlog' })

    expect(action).toEqual({ kind: 'unplan', cookEventId: 'c1' })
  })

  // It is already there. Nothing to say, and certainly nothing to write.
  it('does nothing when a Backlog Item is dropped back on the Backlog', () => {
    const action = resolveDrop({ kind: 'backlog', item: backlogItem }, { kind: 'backlog' })

    expect(action).toEqual({ kind: 'none' })
  })
})
