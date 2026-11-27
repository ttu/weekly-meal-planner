import { act, renderHook, waitFor } from '@testing-library/react-native'
import { randomBytes } from '@noble/hashes/utils'
import { boardWrapper, testClock, TEST_WEEK } from '@/test/session-wrapper'
import { testBoard } from '@/test/test-board'
import { brand } from '@/shared/types/brand'
import { saveMeal, type MealId } from '@/features/meals'

import { addToBacklog } from '../application/planning-data'
import type { WeekStart } from '../domain/types'
import { useWeekBoard } from './useWeekBoard'

const WEEK = brand<string, 'WeekStart'>(TEST_WEEK) as WeekStart

const setup = async () => {
  const board = await testBoard()
  const view = await renderHook(() => useWeekBoard(testClock), { wrapper: boardWrapper(board) })
  return { ...view, board }
}

const makeMeal = async (board: Awaited<ReturnType<typeof testBoard>>, name: string) => {
  let id: MealId | undefined
  await act(async () => {
    const saved = await saveMeal(board.data, randomBytes, {
      name,
      servings: brand<number, 'Servings'>(4),
      ingredients: [],
    })
    if (saved.kind === 'ok') id = saved.value
  })
  if (id === undefined) throw new Error('not saved')
  return id
}

describe('useWeekBoard', () => {
  it('shows the week on screen, named for the Household, with nothing planned yet', async () => {
    const view = await setup()
    await waitFor(() => {
      expect(view.result.current.hasData).toBe(true)
    })
    expect(view.result.current.isLoading).toBe(false)
    expect(view.result.current.weekStart).toBe(TEST_WEEK)
    expect(view.result.current.householdName).toBe('Koti')
    expect(view.result.current.backlog).toEqual([])
    expect(view.result.current.board).toHaveLength(7)
  })

  it('follows the board: a Meal put on the Backlog appears with who wanted it', async () => {
    const view = await setup()
    const mealId = await makeMeal(view.board, 'Tacos')
    await act(async () => {
      await addToBacklog(view.board.data, randomBytes, 1, {
        weekStart: WEEK,
        mealId,
        addedBy: view.board.engine.view().me,
      })
    })
    await waitFor(() => {
      expect(view.result.current.backlog.map((b) => b.mealName)).toEqual(['Tacos'])
    })
    expect(view.result.current.backlog[0]?.addedByName).toBe('Sanni')
  })

  it('drops a planned Meal from the board when its Meal is deleted', async () => {
    const view = await setup()
    const mealId = await makeMeal(view.board, 'Tacos')
    await act(async () => {
      await addToBacklog(view.board.data, randomBytes, 1, {
        weekStart: WEEK,
        mealId,
        addedBy: view.board.engine.view().me,
      })
    })
    await waitFor(() => {
      expect(view.result.current.backlog).toHaveLength(1)
    })
    await act(async () => {
      await view.board.data.remove('meal', mealId)
    })
    await waitFor(() => {
      expect(view.result.current.backlog).toEqual([])
    })
  })
})
