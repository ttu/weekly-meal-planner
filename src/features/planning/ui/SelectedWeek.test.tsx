import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import type { AppStateSource } from '@/shared/net/appState'
import type { Clock } from '@/shared/time/clock'
import { SelectedWeekProvider, useSelectedWeek } from './SelectedWeek'

/** A clock and a foreground that the test moves on by hand. */
const resumable = () => {
  let now = new Date('2026-03-15T20:00:00+02:00')
  const listeners = new Set<(active: boolean) => void>()
  const clock: Clock = { now: () => now }
  const appState: AppStateSource = {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const resumeAt = (iso: string) => {
    now = new Date(iso)
    for (const listener of listeners) listener(true)
  }
  return { clock, appState, resumeAt }
}

describe('SelectedWeekProvider', () => {
  it('rolls onto the new week when the app comes back on a Monday', async () => {
    const { clock, appState, resumeAt } = resumable()
    const Wrapper = ({ children }: { readonly children: ReactNode }) => (
      <SelectedWeekProvider clock={clock} appState={appState}>
        {children}
      </SelectedWeekProvider>
    )
    const view = await renderHook(() => useSelectedWeek(), { wrapper: Wrapper })
    expect(view.result.current.weekStart).toBe('2026-03-09')

    await act(() => {
      resumeAt('2026-03-16T08:00:00+02:00')
    })
    expect(view.result.current.weekStart).toBe('2026-03-16')
    expect(view.result.current.offset).toBe(0)
  })
})
