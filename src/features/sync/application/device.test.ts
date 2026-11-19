import { fakeRandom } from '../domain/fake-random'
import { memberKeyOf } from '../domain/identity'
import { currentHousehold, loadIdentity, rememberHousehold } from './device'
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

  it('remembers which board is open', async () => {
    const storage = memoryKv()
    expect(await currentHousehold(storage)).toBeUndefined()
    await rememberHousehold(storage, 'board-1')
    expect(await currentHousehold(storage)).toBe('board-1')
  })
})
