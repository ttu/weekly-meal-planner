import type { Engine, View } from './engine'

/**
 * An engine's view as an external store React can read. `view()` builds a new
 * object on each call, which `useSyncExternalStore` would treat as a change
 * every render, so the latest one is held and replaced only when the engine says.
 */
export const viewStore = (engine: Pick<Engine, 'view' | 'subscribe'>) => {
  let snapshot: View = engine.view()
  const listeners = new Set<() => void>()
  engine.subscribe(() => {
    snapshot = engine.view()
    listeners.forEach((l) => {
      l()
    })
  })
  return {
    getSnapshot: (): View => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
