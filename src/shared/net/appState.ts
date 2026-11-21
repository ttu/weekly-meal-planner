import { AppState } from 'react-native'

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
