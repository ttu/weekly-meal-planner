import { createContext, use, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { createAppStateSource, type AppStateSource } from '@/shared/net/appState'
import { systemClock, type Clock } from '@/shared/time/clock'
import { weekStartFrom } from '../domain/week'
import type { WeekStart } from '../domain/types'

type SelectedWeek = {
  /** Monday of the week on screen. */
  readonly weekStart: WeekStart
  /** 0 for this week, 1 for next, -1 for last. */
  readonly offset: number
  readonly goToWeek: (offset: number) => void
}

const Context = createContext<SelectedWeek | undefined>(undefined)

/**
 * How far from this week the board is looking.
 *
 * It lives above both the board and the Shopping List because they are two
 * views of one Week Plan: shopping for next week while looking at next week is
 * the only thing that makes sense, and keeping the offset in either screen
 * would let them disagree.
 *
 * Only the offset is held, never a date: the Monday is worked out from the
 * clock on every render, and coming back to the foreground re-renders, so a
 * board opened on Sunday and resumed on Monday shows the new week.
 */
export const SelectedWeekProvider = ({
  children,
  clock = systemClock,
  appState: injected,
}: {
  readonly children: ReactNode
  readonly clock?: Clock
  readonly appState?: AppStateSource
}): React.JSX.Element => {
  const [offset, setOffset] = useState(0)
  const [appState] = useState(() => injected ?? createAppStateSource())
  const [, wake] = useReducer((n: number) => n + 1, 0)
  useEffect(
    () =>
      appState.subscribe((active) => {
        if (active) wake()
      }),
    [appState],
  )
  const weekStart = weekStartFrom(clock, offset)
  const value = useMemo(() => ({ weekStart, offset, goToWeek: setOffset }), [weekStart, offset])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

/**
 * Falls back to this week when no provider is above it, so a screen or a
 * story can render on its own.
 */
export const useSelectedWeek = (clock: Clock = systemClock): SelectedWeek => {
  const fromContext = use(Context)
  const weekStart = weekStartFrom(clock, 0)
  const standalone = useMemo(
    () => ({ weekStart, offset: 0, goToWeek: () => undefined }),
    [weekStart],
  )
  return fromContext ?? standalone
}
