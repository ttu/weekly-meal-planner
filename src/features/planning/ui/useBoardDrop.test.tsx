import { act, renderHook } from '@testing-library/react-native'
import { brand } from '@/shared/types/brand'
import type { SlotKey } from '@/features/household'
import type { BoardDay } from '../domain/board'
import type { BoardCard, CookEvent, Leftover } from '../domain/types'
import type { DragPayload, DropTarget } from './DragContext'
import { useBoardDrop } from './useBoardDrop'

const lunch = brand<string, 'SlotKey'>('lunch') as SlotKey
const dinner = brand<string, 'SlotKey'>('dinner') as SlotKey

const cookEvent: CookEvent = {
  id: brand<string, 'CookEventId'>('c1'),
  mealId: brand<string, 'MealId'>('m1'),
  mealName: 'Chili con carne',
  date: '2026-09-14',
  slotKey: dinner,
  servingsCooked: brand<number, 'Servings'>(6),
  addedByName: 'Aino',
  addedByColour: '#5F7355',
}
const leftover: Leftover = {
  id: brand<string, 'LeftoverId'>('l1'),
  cookEventId: cookEvent.id,
  parentMealName: 'Chili con carne',
  date: '2026-09-15',
  slotKey: lunch,
}

const day = (date: string, lunchCards: BoardCard[], dinnerCards: BoardCard[]): BoardDay => ({
  date,
  slots: [
    { slotKey: lunch, labelKey: 'slot.lunch', cards: lunchCards },
    { slotKey: dinner, labelKey: 'slot.dinner', cards: dinnerCards },
  ],
})
// Dinner on the 14th, and its Leftover at lunch on the 15th.
const board: readonly BoardDay[] = [
  day('2026-09-14', [], [{ kind: 'cook-event', cookEvent }]),
  day('2026-09-15', [{ kind: 'leftover', leftover }], []),
]
const slot = (date: string, slotKey: SlotKey): DropTarget => ({ kind: 'slot', date, slotKey })

const setup = async (hasWeekPlan = true) => {
  const weekPlanId = hasWeekPlan ? 'wp1' : undefined
  const add = jest.fn()
  const plan = jest.fn()
  const actions = { move: jest.fn(), moveLeftoverTo: jest.fn(), unplan: jest.fn() }
  const view = await renderHook(() => useBoardDrop({ board, weekPlanId, add, plan, actions }))
  const drop = (payload: DragPayload, target: DropTarget) =>
    act(() => {
      view.result.current.onDropped(payload, target)
    })
  return { ...view, add, plan, actions, drop }
}

describe('useBoardDrop', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('wants a Meal carried from the library to the Backlog', async () => {
    const v = await setup()
    const meal = {
      id: brand<string, 'MealId'>('m9'),
      name: 'Soup',
      servings: brand<number, 'Servings'>(4),
    }
    await v.drop({ kind: 'library', meal }, { kind: 'backlog' })
    expect(v.add).toHaveBeenCalledWith('m9')
  })

  it('plans a Backlog card onto a Slot, even when the week has no Week Plan yet', async () => {
    const v = await setup(false)
    const item = {
      id: brand<string, 'BacklogItemId'>('b1'),
      mealId: brand<string, 'MealId'>('m1'),
      mealName: 'Chili',
      servings: brand<number, 'Servings'>(4),
      addedByName: 'Aino',
      addedByColour: '#5F7355',
    }
    await v.drop({ kind: 'backlog', item }, slot('2026-09-16', dinner))
    expect(v.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        weekPlanId: undefined,
        mealId: 'm1',
        backlogItemId: 'b1',
        date: '2026-09-16',
        slotKey: dinner,
      }),
    )
  })

  it('moves a Cook Event to an allowed Slot', async () => {
    const v = await setup()
    await v.drop({ kind: 'cook-event', cookEvent }, slot('2026-09-14', lunch))
    expect(v.actions.move).toHaveBeenCalledWith(
      expect.objectContaining({ cookEventId: 'c1', date: '2026-09-14', slotKey: lunch }),
    )
  })

  it('moves a Leftover to a later Slot', async () => {
    const v = await setup()
    await v.drop({ kind: 'leftover', leftover }, slot('2026-09-16', lunch))
    expect(v.actions.moveLeftoverTo).toHaveBeenCalledWith(
      expect.objectContaining({ leftoverId: 'l1', date: '2026-09-16', slotKey: lunch }),
    )
  })

  it('unplans a Cook Event dropped on the Backlog', async () => {
    const v = await setup()
    await v.drop({ kind: 'cook-event', cookEvent }, { kind: 'backlog' })
    expect(v.actions.unplan).toHaveBeenCalledWith('c1')
  })

  it('does nothing for a drop that means nothing', async () => {
    const v = await setup()
    await v.drop({ kind: 'leftover', leftover }, { kind: 'backlog' })
    expect(v.add).not.toHaveBeenCalled()
    expect(v.plan).not.toHaveBeenCalled()
    expect(v.actions.move).not.toHaveBeenCalled()
    expect(v.actions.moveLeftoverTo).not.toHaveBeenCalled()
    expect(v.actions.unplan).not.toHaveBeenCalled()
    expect(v.result.current.orderRefused).toBe(false)
  })

  describe('Leftover order', () => {
    const refusals: readonly (readonly [string, DragPayload, DropTarget])[] = [
      [
        'a Leftover carried back past its Meal',
        { kind: 'leftover', leftover },
        slot('2026-09-13', lunch),
      ],
      [
        'a Meal carried forward past its Leftover',
        { kind: 'cook-event', cookEvent },
        slot('2026-09-16', dinner),
      ],
    ]

    it('keeps saying so for 4s after the latest refusal, not the first', async () => {
      const v = await setup()
      const payload: DragPayload = { kind: 'leftover', leftover }
      await v.drop(payload, slot('2026-09-13', lunch))
      await act(() => {
        jest.advanceTimersByTime(3000)
      })
      await v.drop(payload, slot('2026-09-13', lunch))
      await act(() => {
        jest.advanceTimersByTime(3000)
      })
      expect(v.result.current.orderRefused).toBe(true)
      await act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(v.result.current.orderRefused).toBe(false)
    })

    it.each(refusals)(
      'refuses %s, says so, then stops saying so',
      async (_name, payload, target) => {
        const v = await setup()
        await v.drop(payload, target)
        expect(v.result.current.orderRefused).toBe(true)
        expect(v.actions.move).not.toHaveBeenCalled()
        expect(v.actions.moveLeftoverTo).not.toHaveBeenCalled()

        await act(() => {
          jest.advanceTimersByTime(4000)
        })
        expect(v.result.current.orderRefused).toBe(false)
      },
    )
  })
})
