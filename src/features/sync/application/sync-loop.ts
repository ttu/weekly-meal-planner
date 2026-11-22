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

export type Pace = {
  /** How often to sync while someone is busy on the board. */
  readonly busyMs: number
  /** How often to sync otherwise. */
  readonly quietMs: number
  /** How long a write, here or another Member's, keeps the board busy. */
  readonly busyForMs: number
  readonly now: () => number
}

export const DEFAULT_PACE: Pace = {
  busyMs: 15_000,
  quietMs: 120_000,
  busyForMs: 5 * 60_000,
  now: () => Date.now(),
}

/**
 * Keeps a board current: sync now, on return to the foreground, whenever a
 * local write is waiting to be sent, and on a timer while visible. The timer
 * is quick while someone is busy (a write here, or one from another Member
 * the relay stamped recently) and slow otherwise, so two people planning at
 * once see each other within seconds and an idle board costs little. An
 * offline attempt just waits for the next trigger.
 */
export const startSyncLoop = (
  engine: Pick<Engine, 'sync' | 'view' | 'subscribe' | 'lastHeard'>,
  appState: AppStateSource,
  timers: Timers,
  pace: Pace = DEFAULT_PACE,
): (() => void) => {
  let running = false
  let lastSync = -Infinity
  let lastWrite = -Infinity
  let stopTimer: (() => void) | undefined
  const run = () => {
    if (running) return
    running = true
    lastSync = pace.now()
    void engine.sync().finally(() => {
      running = false
    })
  }
  const tick = () => {
    const now = pace.now()
    const busy = now - Math.max(lastWrite, engine.lastHeard() ?? -Infinity) < pace.busyForMs
    if (busy || now - lastSync >= pace.quietMs) run()
  }
  const begin = () => {
    run()
    stopTimer ??= timers.every(tick, pace.busyMs)
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
    if (engine.view().pending === 0) return
    lastWrite = pace.now()
    run()
  })
  return () => {
    pause()
    unsubscribeApp()
    unsubscribeWrites()
  }
}
