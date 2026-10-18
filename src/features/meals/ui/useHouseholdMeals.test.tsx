import { act, renderHook, waitFor } from '@testing-library/react-native'
import { fakeSupabase, failure, rows, type FakeResponse } from '@/test/fake-supabase'
import { sessionWrapper } from '@/test/session-wrapper'
import { useHouseholdMeals } from './useHouseholdMeals'

const mealRow = {
  id: '0b7d7b1e-0000-4000-8000-000000000002',
  household_id: null,
  name: 'Shakshuka',
  servings: 2,
  photo_url: null,
  meal_ingredient: [{ count: 3 }],
}

const setup = async (initial: Record<string, FakeResponse>) => {
  let responses = initial
  const client = fakeSupabase(() => responses)
  const view = await renderHook(() => useHouseholdMeals(), { wrapper: sessionWrapper(client) })
  return {
    ...view,
    respondWith: (next: Record<string, FakeResponse>) => {
      responses = next
    },
  }
}

describe('useHouseholdMeals', () => {
  it('lists the Meals it loaded', async () => {
    const view = await setup({ meal: rows([mealRow]) })
    await waitFor(() => {
      expect(view.result.current.meals.map((m) => m.name)).toEqual(['Shakshuka'])
    })
    expect(view.result.current.isError).toBe(false)
  })

  it('knows a library with no Meals in it is loaded and empty', async () => {
    const view = await setup({ meal: rows([]) })
    await waitFor(() => {
      expect(view.result.current.hasData).toBe(true)
    })
    expect(view.result.current.isError).toBe(false)
    expect(view.result.current.meals).toEqual([])
  })

  it('reports a failed load as an error with no data, not as an empty library', async () => {
    const view = await setup({ meal: failure })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })
    expect(view.result.current.hasData).toBe(false)
    expect(view.result.current.isLoading).toBe(false)
  })

  it('keeps the last good library when a refresh fails, and recovers on retry', async () => {
    const view = await setup({ meal: rows([mealRow]) })
    await waitFor(() => {
      expect(view.result.current.meals).toHaveLength(1)
    })

    view.respondWith({ meal: failure })
    await act(() => {
      view.result.current.refetch()
    })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })
    expect(view.result.current.meals).toHaveLength(1)

    view.respondWith({ meal: rows([mealRow]) })
    await act(() => {
      view.result.current.refetch()
    })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(false)
    })
  })
})
