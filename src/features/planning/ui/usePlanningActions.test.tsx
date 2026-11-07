import { act, renderHook } from '@testing-library/react-native'
import { fakeSupabase, failure } from '@/test/fake-supabase'
import { sessionWrapper, testClock } from '@/test/session-wrapper'
import type { AppSupabaseClient, SlotKey } from '@/features/household'
import type { CookEventId } from '../domain/types'
import { usePlanningActions } from './usePlanningActions'

const slotKey = 'dinner' as SlotKey
const cookEventId = '0b7d7b1e-0000-4000-8000-000000000005' as CookEventId

/** Counts how many times a table is queried, so a retry shows up as a second call. */
const countingClient = (failing: string): { client: AppSupabaseClient; calls: () => number } => {
  const client = fakeSupabase(() => ({ [failing]: failure }))
  const from = jest.spyOn(client, 'from')
  return { client, calls: () => from.mock.calls.filter(([table]) => table === failing).length }
}

const setup = async (failing: string) => {
  const { client, calls } = countingClient(failing)
  const view = await renderHook(() => usePlanningActions(testClock), {
    wrapper: sessionWrapper(client),
  })
  return { ...view, calls }
}

describe('usePlanningActions', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  /** Long enough for every retry back-off to run out. */
  const settle = () => act(() => jest.advanceTimersByTimeAsync(30_000))

  it('flags a failed Leftover add, and does not retry it', async () => {
    const view = await setup('leftover')
    await act(() => {
      view.result.current.addLeftoverFor({ cookEventId, date: '2026-03-11', slotKey })
    })
    await settle()
    expect(view.result.current.leftoverFailed).toBe(true)
    // an insert that committed but lost its response would be duplicated by a retry
    expect(view.calls()).toBe(1)
  })

  it('retries a failed move twice, then flags it without flagging unplan', async () => {
    const view = await setup('cook_event')
    await act(() => {
      view.result.current.move({ cookEventId, date: '2026-03-11', slotKey })
    })
    await settle()
    expect(view.result.current.moveFailed).toBe(true)
    expect(view.calls()).toBe(3)
    expect(view.result.current.unplanFailed).toBe(false)
  })
})
