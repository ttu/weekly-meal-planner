import { memoryRelay } from '@/test/memory-relay'
import { isOk } from '@/shared/types/result'
import { fakeRandom } from '../domain/fake-random'
import { newIdentity } from '../domain/identity'
import { dataOf, type Data } from './data'
import { createHousehold, type KeyValue } from './engine'

const memoryKv = (): KeyValue => {
  const map = new Map<string, string>()
  return {
    get: (k) => Promise.resolve(map.get(k)),
    set: (k, v) => {
      map.set(k, v)
      return Promise.resolve()
    },
  }
}

describe('dataOf', () => {
  let data: Data

  beforeEach(async () => {
    const random = fakeRandom('data')
    const made = await createHousehold(
      {
        relay: memoryRelay(),
        storage: memoryKv(),
        vault: memoryKv(),
        random,
        clock: { now: () => new Date() },
      },
      newIdentity(random),
    )
    if (!isOk(made)) throw new Error('could not start a board')
    data = dataOf(made.value)
  })

  it('reads back what was put, field by field', async () => {
    await data.put('meal', 'm1', { name: 'Soup', servings: 4 })
    expect(data.get('meal', 'm1')).toEqual({ name: 'Soup', servings: 4 })
  })

  it('merges a later put into the same row instead of replacing it', async () => {
    await data.put('meal', 'm1', { name: 'Soup', servings: 4 })
    await data.put('meal', 'm1', { servings: 6 })
    expect(data.get('meal', 'm1')).toEqual({ name: 'Soup', servings: 6 })
  })

  it('lists one kind and never another that shares its prefix', async () => {
    await data.put('meal', 'm1', { name: 'Soup' })
    await data.put('meal_ingredient', 'i1', { slug: 'onion' })
    expect(data.list('meal').map((r) => r.id)).toEqual(['m1'])
    expect(data.list('meal_ingredient').map((r) => r.id)).toEqual(['i1'])
  })

  it('hides a removed row from reads and lists', async () => {
    await data.put('meal', 'm1', { name: 'Soup' })
    await data.remove('meal', 'm1')
    expect(data.get('meal', 'm1')).toBeUndefined()
    expect(data.list('meal')).toEqual([])
  })

  it('answers undefined for a row nobody wrote', () => {
    expect(data.get('meal', 'nope')).toBeUndefined()
  })

  it('brings a removed row back when it is written to again, keeping its other fields', async () => {
    await data.put('meal', 'm1', { name: 'Soup', servings: 4 })
    await data.remove('meal', 'm1')
    expect(data.get('meal', 'm1')).toBeUndefined()
    await data.put('meal', 'm1', { servings: 6 })
    expect(data.get('meal', 'm1')).toMatchObject({ name: 'Soup', servings: 6 })
  })
})
