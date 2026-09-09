import type { ReactElement } from 'react'
import { render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

/**
 * Anything calling useSafeAreaInsets needs a provider with real metrics; without
 * initialMetrics the provider waits for a native measurement that never arrives
 * in a test and the hook throws.
 */
export const renderWithProviders = (ui: ReactElement): ReturnType<typeof render> =>
  render(<SafeAreaProvider initialMetrics={INSETS}>{ui}</SafeAreaProvider>)
