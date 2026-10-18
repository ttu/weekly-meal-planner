import { createContext, useContext, useMemo } from 'react'
import type { NetworkSource } from './networkSource'
import { createPlatformNetworkSource } from './platformNetworkSource'

const NetworkSourceContext = createContext<NetworkSource | undefined>(undefined)

export const NetworkSourceProvider = ({
  source,
  children,
}: {
  readonly source: NetworkSource
  readonly children: React.ReactNode
}): React.JSX.Element => (
  <NetworkSourceContext.Provider value={source}>{children}</NetworkSourceContext.Provider>
)

/**
 * The injected source, or the platform's own when nothing was injected, so a
 * screen can use `useIsOnline()` without knowing any of this exists.
 */
export const useNetworkSource = (): NetworkSource => {
  const injected = useContext(NetworkSourceContext)
  return useMemo(() => injected ?? createPlatformNetworkSource(), [injected])
}
