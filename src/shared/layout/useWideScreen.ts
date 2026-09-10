import { useWindowDimensions } from 'react-native'

/**
 * The breakpoint from the design: above it the board becomes three panes, below
 * it the phone flow with a docked Backlog shelf. One component tree with a
 * breakpoint, not two apps.
 */
export const WIDE_SCREEN_BREAKPOINT = 1024

export const useWideScreen = (): boolean => {
  const { width } = useWindowDimensions()
  return width >= WIDE_SCREEN_BREAKPOINT
}
