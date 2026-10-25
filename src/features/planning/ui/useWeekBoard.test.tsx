import { act, renderHook, waitFor } from '@testing-library/react-native'
import { fakeSupabase, failure, rows, type FakeResponse } from '@/test/fake-supabase'
import { newQueryClient, sessionWrapper, testClock } from '@/test/session-wrapper'
import { useWeekBoard } from './useWeekBoard'

const planId = '0b7d7b1e-0000-4000-8000-000000000001'
const mealId = '0b7d7b1e-0000-4000-8000-000000000002'
const userId = '0b7d7b1e-0000-4000-8000-000000000003'
const itemId = '0b7d7b1e-0000-4000-8000-000000000004'

const backlogItem = {
  id: itemId,
  meal_id: mealId,
  added_by: userId,
  meal: { name: 'Tacos', servings: 4 },
}
const member = { user_id: userId, display_name: 'Sanni', colour: '#5F7355' }

const setup = async (initial: Record<string, FakeResponse>) => {
  let responses = initial
  const queryClient = newQueryClient()
  const client = fakeSupabase(() => responses)
  const view = await renderHook(() => useWeekBoard(testClock), {
    wrapper: sessionWrapper(client, queryClient),
  })
  return {
    ...view,
    respondWith: (next: Record<string, FakeResponse>) => {
      responses = next
    },
  }
}

describe('useWeekBoard', () => {
  it('is loading, not failed and not empty, until the first answer', async () => {
    const view = await setup({ week_plan: rows(null) })
    expect(view.result.current.isLoading).toBe(true)
    expect(view.result.current.isError).toBe(false)
    await waitFor(() => {
      expect(view.result.current.isLoading).toBe(false)
    })
  })

  it('treats a Week Plan that does not exist yet as an empty board, not an error', async () => {
    const view = await setup({ week_plan: rows(null) })
    await waitFor(() => {
      expect(view.result.current.hasData).toBe(true)
    })
    expect(view.result.current.isError).toBe(false)
    expect(view.result.current.weekPlanId).toBeUndefined()
    expect(view.result.current.backlog).toEqual([])
  })

  it('reports a failed load as an error with no data, not as an empty board', async () => {
    const view = await setup({ week_plan: failure })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })
    expect(view.result.current.hasData).toBe(false)
    expect(view.result.current.isLoading).toBe(false)
  })

  it('reports a failed Backlog load as an error rather than an empty Backlog', async () => {
    const view = await setup({ week_plan: rows({ id: planId }), backlog_item: failure })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })
    expect(view.result.current.hasData).toBe(false)
  })

  it('recovers when the retry succeeds', async () => {
    const view = await setup({ week_plan: failure })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })

    view.respondWith({
      week_plan: rows({ id: planId }),
      backlog_item: rows([backlogItem]),
      household_member: rows([member]),
    })
    await act(() => {
      view.result.current.refetch()
    })

    await waitFor(() => {
      expect(view.result.current.isError).toBe(false)
    })
    expect(view.result.current.backlog.map((item) => item.mealName)).toEqual(['Tacos'])
  })

  // The point of throwing from the queryFn: React Query keeps the last good
  // answer when a refresh fails, so a flaky connection cannot wipe the board.
  it('keeps the last good board when a refresh fails', async () => {
    const view = await setup({
      week_plan: rows({ id: planId }),
      backlog_item: rows([backlogItem]),
      household_member: rows([member]),
    })
    await waitFor(() => {
      expect(view.result.current.backlog).toHaveLength(1)
    })

    view.respondWith({ week_plan: failure })
    await act(() => {
      view.result.current.refetch()
    })

    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })
    expect(view.result.current.hasData).toBe(true)
    expect(view.result.current.weekPlanId).toBe(planId)
    expect(view.result.current.backlog.map((item) => item.mealName)).toEqual(['Tacos'])
  })
})
