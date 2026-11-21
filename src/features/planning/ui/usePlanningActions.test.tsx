import { act, renderHook, waitFor } from '@testing-library/react-native'
import { boardWrapper } from '@/test/session-wrapper'
import { testBoard } from '@/test/test-board'
import { brand } from '@/shared/types/brand'
import type { SlotKey } from '@/features/household'
import type { MealId } from '@/features/meals'
import { useAddToBacklog } from './useAddToBacklog'
import { usePlanMeal } from './usePlanMeal'
import { usePlanningActions } from './usePlanningActions'
import { useWeekBoard } from './useWeekBoard'

const dinner = brand<string, 'SlotKey'>('dinner') as SlotKey
const meal = brand<string, 'MealId'>('catalogue-chili-con-carne') as MealId

const setup = async () => {
  const board = await testBoard()
  return await renderHook(
    () => ({
      week: useWeekBoard(),
      add: useAddToBacklog(),
      plan: usePlanMeal(),
      actions: usePlanningActions(),
    }),
    { wrapper: boardWrapper(board) },
  )
}

describe('the board actions', () => {
  it('adds a Meal to the Backlog, plans it onto a day, and unplans it back', async () => {
    const view = await setup()
    await act(async () => {
      view.result.current.add.add(meal)
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.week.backlog).toHaveLength(1)
    })
    const item = view.result.current.week.backlog[0]
    if (!item) throw new Error('no item')

    await act(async () => {
      view.result.current.plan.plan({
        mealId: item.mealId,
        backlogItemId: item.id,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: brand<number, 'Servings'>(4),
      })
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.week.backlog).toEqual([])
    })
    const day = view.result.current.week.board.find((d) => d.date === '2026-03-11')
    expect(day?.slots.flatMap((s) => s.cards)).toHaveLength(1)

    const cook = day?.slots.flatMap((s) => s.cards).find((c) => c.kind === 'cook-event')
    if (cook?.kind !== 'cook-event') throw new Error('no cook event')
    await act(async () => {
      view.result.current.actions.unplan(cook.cookEvent.id)
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.week.backlog).toHaveLength(1)
    })
  })

  it('flags a Leftover that could not be added, without flagging a move', async () => {
    const view = await setup()
    await act(async () => {
      view.result.current.plan.plan({
        mealId: meal,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: brand<number, 'Servings'>(4),
      })
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(
        view.result.current.week.board.flatMap((d) => d.slots).flatMap((s) => s.cards),
      ).toHaveLength(1)
    })
    const card = view.result.current.week.board.flatMap((d) => d.slots).flatMap((s) => s.cards)[0]
    if (card?.kind !== 'cook-event') throw new Error('no cook event')
    for (let i = 0; i < 21; i++) {
      await act(async () => {
        view.result.current.actions.addLeftoverFor({
          cookEventId: card.cookEvent.id,
          date: '2026-03-12',
          slotKey: dinner,
        })
        // The write finishes a tick later; let it land inside this act.
        await new Promise((resolve) => {
          setTimeout(resolve, 0)
        })
      })
    }
    await waitFor(() => {
      expect(view.result.current.actions.leftoverFailed).toBe(true)
    })
    expect(view.result.current.actions.moveFailed).toBe(false)
    expect(view.result.current.actions.otherFailed).toBe(false)
    await act(async () => {
      view.result.current.actions.setServings(
        card.cookEvent.id,
        brand<number, 'Servings'>(Infinity),
      )
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.actions.otherFailed).toBe(true)
    })
  })
})
