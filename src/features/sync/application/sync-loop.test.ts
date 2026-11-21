import { err, ok } from '@/shared/types/result'
import type { Engine } from './engine'
import { startSyncLoop, type Timers } from './sync-loop'

type SyncResult = Awaited<ReturnType<Engine['sync']>>

const setup = (
  sync: () => Promise<SyncResult> = () => Promise.resolve<SyncResult>(ok(undefined)),
) => {
  let pending = 0
  const engineListeners = new Set<() => void>()
  const engine = {
    sync: jest.fn(sync),
    view: () => ({ pending }) as ReturnType<Engine['view']>,
    subscribe: (l: () => void) => {
      engineListeners.add(l)
      return () => engineListeners.delete(l)
    },
  }
  let appListener: ((active: boolean) => void) | undefined
  const appState = {
    subscribe: (l: (active: boolean) => void) => {
      appListener = l
      return () => undefined
    },
  }
  let tick: () => void = () => undefined
  let timerRunning = false
  const timers: Timers = {
    every: (task) => {
      tick = task
      timerRunning = true
      return () => {
        timerRunning = false
      }
    },
  }
  return {
    engine,
    start: () => startSyncLoop(engine, appState, timers),
    foreground: (active: boolean) => {
      appListener?.(active)
    },
    tick: () => {
      tick()
    },
    timerRunning: () => timerRunning,
    write: () => {
      pending = 1
      engineListeners.forEach((l) => {
        l()
      })
    },
  }
}

describe('sync loop', () => {
  it('syncs at once and on each tick', async () => {
    const t = setup()
    t.start()
    expect(t.engine.sync).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    await Promise.resolve()
    t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(2)
  })

  it('does not start a second sync while one is running', () => {
    const t = setup(() => new Promise(() => undefined))
    t.start()
    t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(1)
  })

  it('stops ticking in the background and syncs again on return', async () => {
    const t = setup()
    t.start()
    await Promise.resolve()
    await Promise.resolve()
    t.foreground(false)
    expect(t.timerRunning()).toBe(false)
    t.foreground(true)
    expect(t.timerRunning()).toBe(true)
    expect(t.engine.sync).toHaveBeenCalledTimes(2)
  })

  it('syncs when a local write is waiting to be sent', async () => {
    const t = setup()
    t.start()
    await Promise.resolve()
    await Promise.resolve()
    t.write()
    expect(t.engine.sync).toHaveBeenCalledTimes(2)
  })

  it('keeps going after a failed attempt, and stops cleanly', async () => {
    const t = setup(() => Promise.resolve<SyncResult>(err('offline')))
    const stop = t.start()
    await Promise.resolve()
    await Promise.resolve()
    t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(2)
    stop()
    expect(t.timerRunning()).toBe(false)
  })
})
