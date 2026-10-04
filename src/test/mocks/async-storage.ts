/**
 * AsyncStorage ships ESM only, which Jest's CJS transform cannot load, and the
 * real one needs a device anyway. Storage is a system boundary, so it is
 * mocked here rather than threaded through every test: an in-memory map with
 * the two methods this app uses.
 */
const store = new Map<string, string>()

export default {
  getItem: (key: string): Promise<string | null> => Promise.resolve(store.get(key) ?? null),
  setItem: (key: string, value: string): Promise<void> => {
    store.set(key, value)
    return Promise.resolve()
  },
  removeItem: (key: string): Promise<void> => {
    store.delete(key)
    return Promise.resolve()
  },
  clear: (): Promise<void> => {
    store.clear()
    return Promise.resolve()
  },
}
