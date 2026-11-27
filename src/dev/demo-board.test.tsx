import { randomBytes } from '@noble/hashes/utils'
import { isOk } from '@/shared/types/result'
import { joinFromLink, readMembers } from '@/features/household'
import { dataOf, newIdentity, type KeyValue, type SyncDeps } from '@/features/sync'
import { memoryRelay } from '@/test/memory-relay'
import { seedDemoBoard } from './demo-board'

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

const deviceOn = (relay: SyncDeps['relay']): SyncDeps => ({
  relay,
  storage: memoryKv(),
  vault: memoryKv(),
  random: randomBytes,
  clock: { now: () => new Date('2026-11-18T12:00:00') },
})

describe('seedDemoBoard', () => {
  it('fills a board with three named Members and a planned week', async () => {
    const deps = deviceOn(memoryRelay())
    const { engine } = await seedDemoBoard(
      deps,
      newIdentity(randomBytes),
      'https://menami.test',
      'en',
    )
    await engine.sync()
    const data = dataOf(engine)

    const names = readMembers(engine.view(), data).map((m) => m.displayName)
    expect(names).toEqual(expect.arrayContaining(['Aino', 'Mikko', 'Sanni']))
    expect(names).toHaveLength(3)
    expect(data.list('cook').length).toBeGreaterThanOrEqual(4)
    expect(data.list('leftover')).toHaveLength(1)
    // Two Members' wishes arrived through the relay, not just this device's own.
    const addedBy = new Set(data.list('backlog').map(({ doc }) => doc.addedBy))
    expect(addedBy.size).toBe(3)
    expect(data.list('meal')).toHaveLength(1)
    expect(data.list('staple').some(({ doc }) => doc.runningLow === true)).toBe(true)
    expect(data.list('extra')).toHaveLength(2)
  })

  it('gives each Member a link that opens the board as them', async () => {
    const relay = memoryRelay()
    const { links } = await seedDemoBoard(
      deviceOn(relay),
      newIdentity(randomBytes),
      'https://menami.test',
      'en',
    )
    expect(links.map((l) => l.name)).toEqual(['Aino', 'Sanni', 'Mikko'])

    const sanni = links[1]
    const opened = await joinFromLink(deviceOn(relay), sanni?.url ?? '', '')
    if (!isOk(opened)) throw new Error('the link did not open the board')
    const { engine } = opened.value
    const me = readMembers(engine.view(), dataOf(engine)).find((m) => m.id === engine.view().me)
    expect(me?.displayName).toBe('Sanni')
  })
})
