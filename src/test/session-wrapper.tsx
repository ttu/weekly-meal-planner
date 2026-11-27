import type { ReactNode } from 'react'
import { SelectedWeekProvider } from '@/features/planning'
import { fixedClock } from '@/shared/time/clock'
import type { TestBoard } from './test-board'

/** Wednesday 11 March 2026: the week of Monday the 9th. */
export const testClock = fixedClock('2026-03-11T10:00:00Z')
export const TEST_WEEK = '2026-03-09'

/**
 * What every board hook sits under: a real board on the real engine, and the
 * week on screen. Nothing here is faked but the network and the device storage.
 */
export const boardWrapper = (
  board: TestBoard,
): ((props: { readonly children: ReactNode }) => React.JSX.Element) => {
  const Wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <board.wrapper>
      <SelectedWeekProvider clock={testClock}>{children}</SelectedWeekProvider>
    </board.wrapper>
  )
  return Wrapper
}
