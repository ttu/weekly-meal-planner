import { act, renderHook, waitFor } from '@testing-library/react-native'
import { fakeSupabase, failure, rows, type FakeResponse } from '@/test/fake-supabase'
import { newQueryClient, sessionWrapper, testClock } from '@/test/session-wrapper'
import { useShoppingList } from './useShoppingList'

const planId = '0b7d7b1e-0000-4000-8000-000000000001'

const planned: Record<string, FakeResponse> = {
  week_plan: rows({ id: planId }),
  cook_event: rows([]),
  household_member: rows([]),
}

const extra = (label: string): FakeResponse =>
  rows([{ id: '0b7d7b1e-0000-4000-8000-000000000009', label, checked_at: null }])

const setup = async (initial: Record<string, FakeResponse>) => {
  let responses = initial
  const client = fakeSupabase(() => responses)
  const view = await renderHook(() => useShoppingList(testClock), {
    wrapper: sessionWrapper(client, newQueryClient()),
  })
  return {
    ...view,
    respondWith: (next: Record<string, FakeResponse>) => {
      responses = next
    },
  }
}

describe('useShoppingList', () => {
  it('derives a list from the Week Plan', async () => {
    const view = await setup({ ...planned, shopping_extra: extra('Coffee') })
    await waitFor(() => {
      expect(view.result.current.list.extras.map((e) => e.label)).toEqual(['Coffee'])
    })
    expect(view.result.current.isError).toBe(false)
  })

  it('has an empty list, not an error, when nothing is planned for the week', async () => {
    const view = await setup({ week_plan: rows(null) })
    await waitFor(() => {
      expect(view.result.current.hasData).toBe(true)
    })
    expect(view.result.current.isError).toBe(false)
    expect(view.result.current.list.buy).toEqual([])
  })

  it('reports a failed Week Plan load as an error, not an empty list', async () => {
    const view = await setup({ week_plan: failure })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })
    expect(view.result.current.hasData).toBe(false)
  })

  it('reports a failed shopping load as an error, not an empty list', async () => {
    const view = await setup({ ...planned, shopping_extra: failure })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })
    expect(view.result.current.hasData).toBe(false)
    expect(view.result.current.isLoading).toBe(false)
  })

  // The bug: the failure was cached as an empty list on top of the good one.
  it('keeps the last good list when a refresh fails, and recovers on retry', async () => {
    const view = await setup({ ...planned, shopping_extra: extra('Coffee') })
    await waitFor(() => {
      expect(view.result.current.list.extras).toHaveLength(1)
    })

    view.respondWith({ ...planned, shopping_extra: failure })
    await act(() => {
      view.result.current.refetch()
    })
    await waitFor(() => {
      expect(view.result.current.isError).toBe(true)
    })
    expect(view.result.current.hasData).toBe(true)
    expect(view.result.current.list.extras.map((e) => e.label)).toEqual(['Coffee'])

    view.respondWith({ ...planned, shopping_extra: extra('Tea') })
    await act(() => {
      view.result.current.refetch()
    })
    await waitFor(() => {
      expect(view.result.current.list.extras.map((e) => e.label)).toEqual(['Tea'])
    })
    expect(view.result.current.isError).toBe(false)
  })
})
