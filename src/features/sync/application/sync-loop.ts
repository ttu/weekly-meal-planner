import type { AppStateSource } from '@/shared/net/appState'
import type { Engine } from './engine'

export type Timers = { readonly every: (task: () => void, ms: number) => () => void }

export const platformTimers: Timers = {
  every: (task, ms) => {
    const id = setInterval(task, ms)
    return () => {
      clearInterval(id)
    }
  },
}

/**
 * Keeps a board current: sync now, on return to the foreground, every
 * `intervalMs` while visible, and whenever a local write is waiting to be sent.
 * An offline attempt just waits for the next trigger.
 */
export const startSyncLoop = (
  engine: Pick<Engine, 'sync' | 'view' | 'subscribe'>,
  appState: AppStateSource,
  timers: Timers,
  intervalMs = 15_000,
): (() => void) => {
  let running = false
  let stopTimer: (() => void) | undefined
  const run = () => {
    if (running) return
    running = true
    void engine.sync().finally(() => {
      running = false
    })
  }
  const begin = () => {
    run()
    stopTimer ??= timers.every(run, intervalMs)
  }
  const pause = () => {
    stopTimer?.()
    stopTimer = undefined
  }
  begin()
  const unsubscribeApp = appState.subscribe((active) => {
    if (active) begin()
    else pause()
  })
  const unsubscribeWrites = engine.subscribe(() => {
    if (engine.view().pending > 0) run()
  })
  return () => {
    pause()
    unsubscribeApp()
    unsubscribeWrites()
  }
}
