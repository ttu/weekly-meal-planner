/**
 * Where "are we online" comes from. A boundary: tests hand in a fake, the app
 * hands in the platform's real thing.
 */
export interface NetworkSource {
  /** The current reading. Async because native has to ask the OS. */
  readonly read: () => Promise<boolean>
  /** Calls back on every change. Returns the unsubscribe. */
  readonly subscribe: (listener: (online: boolean) => void) => () => void
}

interface NativeState {
  readonly isConnected?: boolean | undefined
  readonly isInternetReachable?: boolean | undefined
}

export interface NativeNetworkApi {
  readonly getNetworkStateAsync: () => Promise<NativeState>
  readonly addNetworkStateListener: (listener: (state: NativeState) => void) => {
    readonly remove: () => void
  }
}

/**
 * Unknown counts as online: a wrong "offline" is worse than no banner, and it
 * would pause every query. Reachability is only trusted when it says no.
 */
const toOnline = (state: NativeState): boolean =>
  state.isConnected !== false && state.isInternetReachable !== false

export const createNativeNetworkSource = (api: NativeNetworkApi): NetworkSource => ({
  read: async () => toOnline(await api.getNetworkStateAsync()),
  subscribe: (listener) => {
    const subscription = api.addNetworkStateListener((state) => {
      listener(toOnline(state))
    })
    return () => {
      subscription.remove()
    }
  },
})

export interface WebWindow {
  readonly navigator: { readonly onLine?: boolean }
  readonly addEventListener: (name: 'online' | 'offline', fn: () => void) => void
  readonly removeEventListener: (name: 'online' | 'offline', fn: () => void) => void
}

export const createWebNetworkSource = (win: WebWindow | undefined): NetworkSource => ({
  read: () => Promise.resolve(win?.navigator.onLine ?? true),
  subscribe: (listener) => {
    if (!win) return () => undefined
    const up = (): void => {
      listener(true)
    }
    const down = (): void => {
      listener(false)
    }
    win.addEventListener('online', up)
    win.addEventListener('offline', down)
    return () => {
      win.removeEventListener('online', up)
      win.removeEventListener('offline', down)
    }
  },
})
