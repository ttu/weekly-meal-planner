import type { ReactElement } from 'react'
import { render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NetworkSourceProvider } from '@/shared/net/NetworkSourceContext'
import type { NetworkSource } from '@/shared/net/networkSource'

/** Always online: the device's network is a system boundary, faked here. */
export const onlineSource: NetworkSource = {
  read: () => Promise.resolve(true),
  subscribe: () => () => undefined,
}

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
  render(
    <SafeAreaProvider initialMetrics={INSETS}>
      <NetworkSourceProvider source={onlineSource}>{ui}</NetworkSourceProvider>
    </SafeAreaProvider>,
  )
