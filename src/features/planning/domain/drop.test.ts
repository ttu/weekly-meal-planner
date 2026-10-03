import { brand } from '@/shared/types/brand'
import { resolveDrop, type DropTarget } from './drop'
import type { BacklogItem, CookEvent, Leftover } from './types'

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

const leftover: Leftover = {
  id: brand<string, 'LeftoverId'>('l1'),
  cookEventId: brand<string, 'CookEventId'>('c1'),
  parentMealName: 'Chili con carne',
  date: '2026-09-15',
  slotKey: brand<string, 'SlotKey'>('lunch'),
}

const libraryMeal = {
  id: brand<string, 'MealId'>('m9'),
  name: 'Lohikeitto',
  servings: brand<number, 'Servings'>(4),
}

describe('resolveDrop', () => {
  // The canvas's one gesture direction: library → backlog → board.
  it('wants a Meal carried from the library to the Backlog', () => {
    const action = resolveDrop({ kind: 'library', meal: libraryMeal }, { kind: 'backlog' })

    expect(action).toEqual({ kind: 'want', mealId: 'm9' })
  })

  // The Backlog is a staging post, not a toll gate.
  it('plans a Meal carried from the library straight onto a day', () => {
    const action = resolveDrop({ kind: 'library', meal: libraryMeal }, slot('2026-09-17', 'dinner'))

    expect(action).toEqual({
      kind: 'plan',
      mealId: 'm9',
      date: '2026-09-17',
      slotKey: 'dinner',
      servingsCooked: 4,
    })
  })

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

  // "We'll finish it on Friday instead" is the commonest edit there is.
  it('moves a Leftover dropped on another Slot', () => {
    const action = resolveDrop({ kind: 'leftover', leftover }, slot('2026-09-18', 'dinner'))

    expect(action).toEqual({
      kind: 'move-leftover',
      leftoverId: 'l1',
      date: '2026-09-18',
      slotKey: 'dinner',
    })
  })

  it('does nothing when a Leftover is dropped back where it was', () => {
    const action = resolveDrop({ kind: 'leftover', leftover }, slot('2026-09-15', 'lunch'))

    expect(action).toEqual({ kind: 'none' })
  })

  // A Leftover is not a Meal anyone wants this week, it is a second sitting of
  // one already cooked. There is nothing to put on the Backlog, so the card's
  // own remove is the way off the board.
  it('does nothing when a Leftover is dropped on the Backlog', () => {
    const action = resolveDrop({ kind: 'leftover', leftover }, { kind: 'backlog' })

    expect(action).toEqual({ kind: 'none' })
  })
})
