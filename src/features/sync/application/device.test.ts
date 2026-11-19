import { fakeRandom } from '../domain/fake-random'
import { memberKeyOf, newIdentity } from '../domain/identity'
import { loadIdentity, recallBoard, rememberBoard } from './device'
import type { KeyValue } from './engine'

const memoryKv = (initial: Record<string, string> = {}): KeyValue => {
  const data = new Map(Object.entries(initial))
  return {
    get: (k) => Promise.resolve(data.get(k)),
    set: (k, v) => {
      data.set(k, v)
      return Promise.resolve()
    },
  }
}

describe('device', () => {
  it('makes an identity once and finds the same one afterwards', async () => {
    const vault = memoryKv()
    const first = await loadIdentity(vault, fakeRandom('a'))
    const again = await loadIdentity(vault, fakeRandom('b'))
    expect(memberKeyOf(again)).toBe(memberKeyOf(first))
    expect(again.box.publicKey).toEqual(first.box.publicKey)
  })

  it('refuses an unreadable identity instead of replacing it', async () => {
    await expect(
      loadIdentity(memoryKv({ 'sync/device': '{"nope":1}' }), fakeRandom('a')),
    ).rejects.toThrow()
  })

  it('remembers the open board and who this device is on it', async () => {
    const deps = { storage: memoryKv(), vault: memoryKv() }
    expect(await recallBoard(deps)).toBeUndefined()
    const seat = newIdentity(fakeRandom('seat'))
    await rememberBoard(deps, 'board-1', seat)
    const recalled = await recallBoard(deps)
    expect(recalled?.household).toBe('board-1')
    expect(recalled && memberKeyOf(recalled.identity)).toBe(memberKeyOf(seat))
  })
})
