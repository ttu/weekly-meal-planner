import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
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
 * Only the offset is held, never a date: a board left open overnight should
 * roll onto the new week with the clock, not stay on yesterday's Monday.
 */
export const SelectedWeekProvider = ({
  children,
  clock = systemClock,
}: {
  readonly children: ReactNode
  readonly clock?: Clock
}): React.JSX.Element => {
  const [offset, setOffset] = useState(0)
  const value = useMemo(
    () => ({ weekStart: weekStartFrom(clock, offset), offset, goToWeek: setOffset }),
    [clock, offset],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

/**
 * Falls back to this week when no provider is above it, so a screen or a
 * story can render on its own.
 */
export const useSelectedWeek = (clock: Clock = systemClock): SelectedWeek => {
  const fromContext = useContext(Context)
  const standalone = useMemo(
    () => ({ weekStart: weekStartFrom(clock, 0), offset: 0, goToWeek: () => undefined }),
    [clock],
  )
  return fromContext ?? standalone
}
