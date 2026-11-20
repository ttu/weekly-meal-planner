import { memoryRelay } from '@/test/memory-relay'
import { randomBytes } from '@noble/hashes/utils'
import {
  dataOf,
  identityFromInvite,
  memberKeyOf,
  newIdentity,
  type KeyValue,
  type SyncDeps,
} from '@/features/sync'
import { isOk } from '@/shared/types/result'
import { readMembers, readSettings, saveSettings } from './board-data'
import { joinBoard, joinFromLink, recoveryLink, startBoard } from './board-flow'
import { inviteLink, parseInviteLink } from '../domain/invite-link'
import { memoryDirectory } from '../../../../relay/memory'

const memoryKv = (): KeyValue => {
  const data = new Map<string, string>()
  return {
    get: (k) => Promise.resolve(data.get(k)),
    set: (k, v) => {
      data.set(k, v)
      return Promise.resolve()
    },
  }
}

const server = memoryDirectory()
const device = (): SyncDeps => ({
  relay: memoryRelay(server),
  storage: memoryKv(),
  vault: memoryKv(),
  random: randomBytes,
  clock: { now: () => new Date() },
})

describe('starting and joining a board', () => {
  it('names the board and its first Member, an admin', async () => {
    const deps = device()
    const started = await startBoard(deps, newIdentity(randomBytes), {
      boardName: 'Home',
      displayName: 'Alice',
      locale: 'en',
    })
    if (!isOk(started)) throw new Error('could not start')
    const data = dataOf(started.value)
    expect(readSettings(started.value.view(), data)).toMatchObject({
      name: 'Home',
      locale: 'en',
      size: 4,
    })
    expect(readMembers(started.value.view(), data)).toMatchObject([
      { displayName: 'Alice', role: 'admin' },
    ])
  })

  it('lets someone join from the link, named, in a colour nobody else has', async () => {
    const aliceDeps = device()
    const started = await startBoard(aliceDeps, newIdentity(randomBytes), {
      boardName: 'Home',
      displayName: 'Alice',
      locale: 'fi',
    })
    if (!isOk(started)) throw new Error('could not start')
    const alice = started.value
    const invited = await alice.invite('member')
    if (!isOk(invited)) throw new Error('no invite')
    const seat = parseInviteLink(inviteLink('https://menami.app', invited.value))
    if (!seat) throw new Error('bad link')

    const bobDeps = device()
    const joined = await joinBoard(bobDeps, seat, 'Bob')
    if (!isOk(joined)) throw new Error('could not join')
    const bob = joined.value
    expect(bob.view().me).toBe(memberKeyOf(identityFromInvite(invited.value)))
    await alice.sync()
    const members = readMembers(alice.view(), dataOf(alice))
    expect(members.map((m) => m.displayName).sort((a, b) => a.localeCompare(b))).toEqual([
      'Alice',
      'Bob',
    ])
    expect(new Set(members.map((m) => m.colour)).size).toBe(2)
    expect(members.find((m) => m.displayName === 'Bob')?.role).toBe('member')
  })

  it('restores a Member from their recovery link as themselves, name and colour kept', async () => {
    const started = await startBoard(device(), newIdentity(randomBytes), {
      boardName: 'Home',
      displayName: 'Alice',
      locale: 'en',
    })
    if (!isOk(started)) throw new Error('could not start')
    const alice = started.value
    const before = readMembers(alice.view(), dataOf(alice))
    const link = recoveryLink(alice, 'https://menami.app')
    if (link === undefined) throw new Error('no recovery link')

    const restored = await joinFromLink(device(), link, 'Someone else')
    if (!isOk(restored)) throw new Error('could not restore')
    const engine = restored.value.engine
    expect(engine.view().me).toBe(alice.view().me)
    expect(readMembers(engine.view(), dataOf(engine))).toEqual(before)
  })

  it('reads settings safely when another Member wrote nonsense', async () => {
    const deps = device()
    const started = await startBoard(deps, newIdentity(randomBytes), {
      boardName: 'Home',
      displayName: 'Carol',
      locale: 'en',
    })
    if (!isOk(started)) throw new Error('could not start')
    const data = dataOf(started.value)
    await data.put('household', 'main', { size: 9999, locale: 'xx', slots: 'nope' })
    expect(readSettings(started.value.view(), data)).toMatchObject({ size: 4, locale: 'fi' })
    expect(readSettings(started.value.view(), data).slots.length).toBeGreaterThan(0)
    await saveSettings(data, { name: 'Renamed' })
    expect(readSettings(started.value.view(), data).name).toBe('Renamed')
  })
})
