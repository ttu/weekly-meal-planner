import { useEffect } from 'react'
import { AppState } from 'react-native'
import { focusManager, onlineManager } from '@tanstack/react-query'
import type { NetworkSource } from './networkSource'

/** Foreground/background, as a boundary so tests need no AppState. */
export interface AppStateSource {
  readonly subscribe: (listener: (active: boolean) => void) => () => void
}

export const createAppStateSource = (): AppStateSource => ({
  subscribe: (listener) => {
    const subscription = AppState.addEventListener('change', (status) => {
      listener(status === 'active')
    })
    return () => {
      subscription.remove()
    }
  },
})

/**
 * Feeds TanStack Query the two signals it cannot see in React Native.
 *
 * Focus: iOS suspends the realtime socket in the background, so the board and
 * the Shopping List can be stale on return; becoming active refetches every
 * mounted query. Online: a reconnect refetches and un-pauses queued mutations.
 *
 * The managers are the library's own singletons; this only points them at the
 * injected sources and lets go on unmount.
 */
export const useQueryLifecycle = (network: NetworkSource, appState: AppStateSource): void => {
  useEffect(() => {
    focusManager.setEventListener((handleFocus) => appState.subscribe(handleFocus))
    return () => {
      focusManager.setEventListener(() => () => undefined)
    }
  }, [appState])

  useEffect(() => {
    onlineManager.setEventListener((setOnline) => {
      void network.read().then(setOnline)
      return network.subscribe(setOnline)
    })
    return () => {
      onlineManager.setEventListener(() => () => undefined)
    }
  }, [network])
}
