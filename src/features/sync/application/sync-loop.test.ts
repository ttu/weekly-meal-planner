import { err, ok } from '@/shared/types/result'
import type { Engine } from './engine'
import { startSyncLoop, type Pace, type Timers } from './sync-loop'

type SyncResult = Awaited<ReturnType<Engine['sync']>>

const SECOND = 1000
const MINUTE = 60 * SECOND

const setup = (
  sync: () => Promise<SyncResult> = () => Promise.resolve<SyncResult>(ok(undefined)),
) => {
  let pending = 0
  let wall = 1_000_000
  let heard: number | undefined
  const engineListeners = new Set<() => void>()
  const engine = {
    sync: jest.fn(sync),
    view: () => ({ pending }) as ReturnType<Engine['view']>,
    subscribe: (l: () => void) => {
      engineListeners.add(l)
      return () => engineListeners.delete(l)
    },
    lastHeard: () => heard,
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
  const pace: Pace = {
    busyMs: 15 * SECOND,
    quietMs: 2 * MINUTE,
    busyForMs: 5 * MINUTE,
    now: () => wall,
  }
  /** Lets a finished sync clear its running flag. */
  const settle = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }
  return {
    engine,
    start: () => startSyncLoop(engine, appState, timers, pace),
    foreground: (active: boolean) => {
      appListener?.(active)
    },
    /** One timer tick, `ms` after the last. */
    tick: async (ms = 15 * SECOND) => {
      wall += ms
      tick()
      await settle()
    },
    settle,
    timerRunning: () => timerRunning,
    write: () => {
      pending = 1
      engineListeners.forEach((l) => {
        l()
      })
      pending = 0
    },
    heardFromOthers: (ago: number) => {
      heard = wall - ago
    },
  }
}

describe('sync loop', () => {
  it('syncs at once, then only every couple of minutes on a quiet board', async () => {
    const t = setup()
    t.start()
    await t.settle()
    expect(t.engine.sync).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 7; i++) await t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(1)
    await t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(2)
  })

  it('syncs on every tick while another Member was heard from recently', async () => {
    const t = setup()
    t.start()
    await t.settle()
    t.heardFromOthers(30 * SECOND)
    await t.tick()
    await t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(3)
  })

  it('goes quiet again once nobody has written for a while', async () => {
    const t = setup()
    t.start()
    await t.settle()
    t.heardFromOthers(6 * MINUTE)
    await t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(1)
  })

  it('stays quick for a while after a write made here', async () => {
    const t = setup()
    t.start()
    await t.settle()
    t.write()
    await t.settle()
    expect(t.engine.sync).toHaveBeenCalledTimes(2)
    await t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(3)
  })

  it('does not start a second sync while one is running', () => {
    const t = setup(() => new Promise(() => undefined))
    t.start()
    t.heardFromOthers(0)
    void t.tick()
    expect(t.engine.sync).toHaveBeenCalledTimes(1)
  })

  it('stops ticking in the background and syncs again on return', async () => {
    const t = setup()
    t.start()
    await t.settle()
    t.foreground(false)
    expect(t.timerRunning()).toBe(false)
    t.foreground(true)
    expect(t.timerRunning()).toBe(true)
    expect(t.engine.sync).toHaveBeenCalledTimes(2)
  })

  it('keeps going after a failed attempt, and stops cleanly', async () => {
    const t = setup(() => Promise.resolve<SyncResult>(err('offline')))
    const stop = t.start()
    await t.settle()
    await t.tick(2 * MINUTE)
    expect(t.engine.sync).toHaveBeenCalledTimes(2)
    stop()
    expect(t.timerRunning()).toBe(false)
  })
})
