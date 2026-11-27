import { viewStore } from './view-store'
import type { Engine } from './engine'

describe('viewStore', () => {
  const fake = () => {
    let n = 0
    let notify: () => void = () => undefined
    const engine = {
      view: () => ({ pending: n }) as ReturnType<Engine['view']>,
      subscribe: (l: () => void) => {
        notify = l
        return () => undefined
      },
    }
    return {
      engine,
      change: () => {
        n += 1
        notify()
      },
    }
  }

  it('returns the same snapshot until the engine changes', () => {
    const { engine, change } = fake()
    const store = viewStore(engine)
    expect(store.getSnapshot()).toBe(store.getSnapshot())
    const before = store.getSnapshot()
    change()
    expect(store.getSnapshot()).not.toBe(before)
    expect(store.getSnapshot().pending).toBe(1)
  })

  it('tells listeners, until they let go', () => {
    const { engine, change } = fake()
    const store = viewStore(engine)
    const listener = jest.fn()
    const off = store.subscribe(listener)
    change()
    off()
    change()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
