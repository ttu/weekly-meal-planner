import { memoryRelay } from '@/test/memory-relay'
import { memoryDirectory } from '../../../../relay/memory'
import { isErr, isOk, type Result } from '@/shared/types/result'
import type { Clock } from '@/shared/time/clock'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { encrypt } from '../domain/crypto'
import { fakeRandom } from '../domain/fake-random'
import { memberKeyOf, newIdentity, type Identity } from '../domain/identity'
import { tokenFor } from '../domain/relay'
import { readField } from '../domain/store'
import {
  createHousehold,
  identityFromInvite,
  joinHousehold,
  openHousehold,
  type Engine,
  type KeyValue,
  type Invite,
} from './engine'

const memoryKv = (): KeyValue => {
  const data = new Map<string, string>()
  return {
    get: (key) => Promise.resolve(data.get(key)),
    set: (key, value) => {
      data.set(key, value)
      return Promise.resolve()
    },
  }
}

const must = <T, E>(r: Result<T, E>): T => {
  if (!isOk(r)) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`)
  return r.value
}
const seatOf = (e: Engine): Invite => {
  const seat = e.ownSeat()
  if (!seat) throw new Error('no seat')
  return seat
}
const errorOf = <T, E>(r: Result<T, E>): E | undefined => (isErr(r) ? r.error : undefined)

describe('sync engine', () => {
  let server = memoryDirectory()
  let online = true
  let wall = 1_700_000_000_000
  const clock: Clock = { now: () => new Date(wall) }
  const tick = (ms = 1000) => {
    wall += ms
  }

  beforeEach(() => {
    server = memoryDirectory()
    online = true
    wall = Date.now()
  })

  const device = (name: string) => ({
    storage: memoryKv(),
    vault: memoryKv(),
    random: fakeRandom(name),
    clock,
    relay: memoryRelay(server, () => online),
  })
  type Device = ReturnType<typeof device>

  const start = async (name: string): Promise<{ engine: Engine; dev: Device; me: Identity }> => {
    const dev = device(name)
    const me = newIdentity(dev.random)
    return { engine: must(await createHousehold(dev, me)), dev, me }
  }

  const joinAs = async (name: string, invite: Invite): Promise<{ engine: Engine; dev: Device }> => {
    const dev = device(name)
    const engine = must(await joinHousehold(dev, invite))
    must(await engine.sync())
    return { engine, dev }
  }

  const title = (e: Engine, entity = 'meal:soup') => readField(e.view().store, entity, 'title')

  it('keeps what you write, before and after it reaches the relay', async () => {
    const { engine } = await start('alice')
    await engine.write('meal:soup', 'title', 'Soup')
    expect(title(engine)).toBe('Soup')
    expect(engine.view().pending).toBe(1)
    expect(engine.view()).toBe(engine.view())
    must(await engine.sync())
    expect(engine.view().pending).toBe(0)
    expect(title(engine)).toBe('Soup')
  })

  it('shares a board with someone who opens an invite', async () => {
    const { engine: alice } = await start('alice')
    await alice.write('meal:soup', 'title', 'Soup')
    must(await alice.sync())
    const invite = must(await alice.invite('member'))
    const { engine: bob } = await joinAs('bob', invite)
    expect(title(bob)).toBe('Soup')
    expect(bob.view().role).toBe('member')

    tick()
    await bob.write('meal:stew', 'title', 'Stew')
    must(await bob.sync())
    must(await alice.sync())
    expect(title(alice, 'meal:stew')).toBe('Stew')
  })

  it('converges when two people edit the same field while apart', async () => {
    const { engine: alice } = await start('alice')
    const { engine: bob } = await joinAs('bob', must(await alice.invite('member')))
    await alice.write('meal:soup', 'title', 'Soup')
    tick()
    await bob.write('meal:soup', 'title', 'Stew')
    for (const e of [alice, bob, alice, bob]) must(await e.sync())
    expect(title(alice)).toBe('Stew')
    expect(title(bob)).toBe('Stew')
  })

  it('queues writes made offline and sends them when the connection returns', async () => {
    const { engine: alice } = await start('alice')
    const { engine: bob } = await joinAs('bob', must(await alice.invite('member')))
    online = false
    await alice.write('meal:soup', 'title', 'Soup')
    expect(errorOf(await alice.sync())).toBe('offline')
    expect(title(alice)).toBe('Soup')
    online = true
    must(await alice.sync())
    must(await bob.sync())
    expect(title(bob)).toBe('Soup')
  })

  it('keeps secrets out of ordinary storage, and drops the invite token once keys arrive', async () => {
    const { engine: alice } = await start('alice')
    const invite = must(await alice.invite('member'))
    const { engine: bob, dev } = await joinAs('bob', invite)
    const plain = (await dev.storage.get(`sync/${bob.household}`)) ?? ''
    expect(plain).not.toContain(invite.token)
    for (const key of Object.values(bob.debugKeys())) expect(plain).not.toContain(bytesToHex(key))
    const vault = (await dev.vault.get(`sync/${bob.household}/keys`)) ?? ''
    expect(vault).not.toContain(invite.token)
    expect(vault).toContain(bytesToHex(bob.debugKeys()['1'] ?? new Uint8Array()))
  })

  it('survives closing the app: a reopened board has the same data and pending writes', async () => {
    const { engine, dev, me } = await start('alice')
    await engine.write('meal:soup', 'title', 'Soup')
    must(await engine.sync())
    online = false
    await engine.write('meal:soup', 'servings', 4)
    const reopened = await openHousehold(dev, me, engine.household)
    expect(reopened && title(reopened)).toBe('Soup')
    expect(reopened && readField(reopened.view().store, 'meal:soup', 'servings')).toBe(4)
    expect(reopened?.view().pending).toBe(1)
  })

  describe('restoring a Member on a new device from their own seat', () => {
    it('brings back the same Member, role and data', async () => {
      const { engine: alice } = await start('alice')
      await alice.write('meal:soup', 'title', 'Soup')
      must(await alice.sync())
      const { engine: restored } = await joinAs('alice-new-phone', seatOf(alice))
      expect(restored.view().me).toBe(alice.view().me)
      expect(restored.view().role).toBe('admin')
      expect(title(restored)).toBe('Soup')
    })

    it('still works after someone was removed and the board moved to a new token', async () => {
      const { engine: alice } = await start('alice')
      const seat = seatOf(alice)
      const { engine: bob } = await joinAs('bob', must(await alice.invite('member')))
      must(await alice.removeMember(bob.view().me))
      tick()
      await alice.write('meal:secret', 'title', 'After bob')
      must(await alice.sync())
      const { engine: restored } = await joinAs('alice-new-phone', seat)
      expect(title(restored, 'meal:secret')).toBe('After bob')
    })

    it('keeps the old and new phone in agreement when both edit at the same instant', async () => {
      const { engine: alice } = await start('alice')
      const { engine: again } = await joinAs('alice-new-phone', seatOf(alice))
      await alice.write('meal:soup', 'title', 'Soup')
      await again.write('meal:soup', 'title', 'Stew')
      for (const e of [alice, again, alice, again]) must(await e.sync())
      expect(title(alice)).toBe(title(again))
    })
  })

  describe('removing a Member', () => {
    const threeOfThem = async () => {
      const { engine: alice } = await start('alice')
      const { engine: bob } = await joinAs('bob', must(await alice.invite('member')))
      const { engine: carol } = await joinAs('carol', must(await alice.invite('member')))
      must(await alice.sync())
      return { alice, bob, carol, bobKey: bob.view().me }
    }

    it('lets the others carry on and shuts the removed Member out of what comes next', async () => {
      const { alice, bob, carol, bobKey } = await threeOfThem()
      must(await alice.removeMember(bobKey))
      tick()
      await alice.write('meal:secret', 'title', 'After bob')
      must(await alice.sync())
      must(await carol.sync())
      expect(title(carol, 'meal:secret')).toBe('After bob')
      expect(errorOf(await bob.sync())).toBe('forbidden')
      expect(bob.view().status).toBe('removed')
      expect(title(bob, 'meal:secret')).toBeUndefined()
    })

    it('refuses writes from the removed Member', async () => {
      const { alice, bob, bobKey } = await threeOfThem()
      must(await alice.removeMember(bobKey))
      await bob.write('meal:evil', 'title', 'Evil')
      expect(errorOf(await bob.sync())).toBe('forbidden')
      must(await alice.sync())
      expect(title(alice, 'meal:evil')).toBeUndefined()
    })

    it('keeps history readable for everyone who stays', async () => {
      const { alice, carol, bobKey } = await threeOfThem()
      await alice.write('meal:old', 'title', 'Before')
      must(await alice.sync())
      must(await alice.removeMember(bobKey))
      must(await carol.sync())
      expect(title(carol, 'meal:old')).toBe('Before')
    })

    it('lets a Member who joins afterwards read everything, old epochs included', async () => {
      const { alice, bobKey } = await threeOfThem()
      await alice.write('meal:old', 'title', 'Before')
      must(await alice.sync())
      must(await alice.removeMember(bobKey))
      const { engine: dave } = await joinAs('dave', must(await alice.invite('member')))
      expect(title(dave, 'meal:old')).toBe('Before')
    })

    it('refuses a plain Member trying to remove someone', async () => {
      const { bob, carol } = await threeOfThem()
      expect(errorOf(await bob.removeMember(carol.view().me))).toBe('notAdmin')
    })
  })

  describe('admins', () => {
    it('lets a promoted Member invite others, and hand the role over', async () => {
      const { engine: alice } = await start('alice')
      const { engine: bob } = await joinAs('bob', must(await alice.invite('member')))
      must(await alice.setRole(bob.view().me, 'admin'))
      must(await bob.sync())
      const { engine: carol } = await joinAs('carol', must(await bob.invite('member')))
      must(await bob.setRole(alice.view().me, 'member'))
      must(await alice.sync())
      expect(alice.view().role).toBe('member')
      expect(carol.view().role).toBe('member')
      expect(errorOf(await alice.invite('member'))).toBe('notAdmin')
    })

    it('reports a conflict when two admins act on the same state at once', async () => {
      const { engine: alice } = await start('alice')
      const { engine: bob } = await joinAs('bob', must(await alice.invite('admin')))
      const results = await Promise.all([alice.invite('member'), bob.invite('member')])
      expect(results.filter(isOk)).toHaveLength(1)
      expect(results.map(errorOf)).toContain('conflict')
    })
  })

  describe('a hostile Member', () => {
    const attack = async () => {
      const { engine: alice, dev } = await start('alice')
      const { engine: bob, dev: bobDev } = await joinAs('bob', must(await alice.invite('member')))
      const mallory = { engine: bob, dev: bobDev }
      return { alice, bob, mallory, dev }
    }

    const injectRaw = async (e: Engine, kind: 'event' | 'membership', payload: string) => {
      const keys = e.debugKeys()
      const epoch = e.view().epoch
      const key = keys[epoch]
      if (!key) throw new Error('no key')
      const token = tokenFor(key, e.household)
      return memoryRelay(server).append(e.household, token, epoch, kind, payload)
    }

    it('cannot stall everyone with garbage records', async () => {
      const { alice, bob } = await attack()
      await injectRaw(bob, 'event', 'zz-not-hex')
      await injectRaw(bob, 'event', 'ab'.repeat(100))
      await injectRaw(bob, 'membership', bytesToHex(new TextEncoder().encode('{"nope":1}')))
      await alice.write('meal:soup', 'title', 'Soup')
      must(await alice.sync())
      must(await bob.sync())
      expect(title(bob)).toBe('Soup')
    })

    it('cannot win a field for good with a far-future clock', async () => {
      const { alice, bob } = await attack()
      const key = bob.debugKeys()[bob.view().epoch]
      if (!key) throw new Error('no key')
      const evil = {
        id: 'evil',
        hlc: { wall: wall + 365 * 24 * 3600_000, counter: 0, node: 'evil' },
        entity: 'meal:soup',
        field: 'title',
        value: 'Pwned',
      }
      const sealed = encrypt(
        key,
        { household: bob.household, epoch: bob.view().epoch },
        new TextEncoder().encode(JSON.stringify(evil)),
        fakeRandom('evil'),
      )
      await injectRaw(bob, 'event', bytesToHex(sealed))
      tick()
      await alice.write('meal:soup', 'title', 'Soup')
      must(await alice.sync())
      must(await bob.sync())
      expect(title(alice)).toBe('Soup')
      expect(title(bob)).toBe('Soup')
    })

    it('cannot add themselves as admin with a forged membership op', async () => {
      const { alice, bob } = await attack()
      await injectRaw(bob, 'membership', hexOfJson({ body: {}, signer: 'x', signature: 'y' }))
      must(await alice.sync())
      expect(alice.view().role).toBe('admin')
      expect(bob.view().role).toBe('member')
    })

    function hexOfJson(v: unknown): string {
      return bytesToHex(new TextEncoder().encode(JSON.stringify(v)))
    }

    it('is not able to read past an epoch it was never given', async () => {
      const { alice, bob } = await attack()
      must(await alice.removeMember(bob.view().me))
      await alice.write('meal:soup', 'title', 'Secret')
      must(await alice.sync())
      expect(Object.keys(bob.debugKeys())).toEqual(['1'])
    })
  })

  describe('staying usable when something goes wrong', () => {
    const stillWorks = async (...engines: Engine[]) => {
      for (const e of engines) {
        tick()
        await e.write(`meal:${e.view().me}`, 'title', 'Still here')
        must(await e.sync())
        expect(e.view().pending).toBe(0)
      }
    }

    it('refuses removing someone who is not a Member, and the board carries on', async () => {
      const { engine: alice } = await start('alice')
      expect(errorOf(await alice.removeMember('ab'.repeat(32)))).toBe('unknownMember')
      expect(alice.view().epoch).toBe(1)
      await stillWorks(alice)
    })

    it('builds a removal again when another admin changed membership first, and nobody is locked out', async () => {
      const { engine: alice } = await start('alice')
      const { engine: bob } = await joinAs('bob', must(await alice.invite('admin')))
      const { engine: carol } = await joinAs('carol', must(await alice.invite('member')))
      must(await bob.sync())
      must(await alice.invite('member'))
      must(await bob.removeMember(carol.view().me))
      await stillWorks(alice, bob)
      expect(errorOf(await carol.sync())).toBe('forbidden')
    })

    it('gives a late joiner every change, however many arrived before their key', async () => {
      const { engine: alice } = await start('alice')
      for (let i = 0; i < 2100; i++)
        await alice.write(`meal:m${String(i)}`, 'title', `t${String(i)}`)
      must(await alice.sync())
      const { engine: late } = await joinAs('late', must(await alice.invite('member')))
      expect(Object.keys(late.view().store)).toHaveLength(Object.keys(alice.view().store).length)
    }, 60_000)

    it('picks up where it was when saving the keys failed', async () => {
      const { engine: alice } = await start('alice')
      let broken = false
      const plain = device('bob')
      const vault: KeyValue = {
        get: plain.vault.get,
        set: (k, v) =>
          broken ? Promise.reject(new Error('secure store failed')) : plain.vault.set(k, v),
      }
      const dev = { ...plain, vault }
      const bob = must(await joinHousehold(dev, must(await alice.invite('member'))))
      const { engine: carol } = await joinAs('carol', must(await alice.invite('member')))
      must(await alice.removeMember(carol.view().me))
      broken = true
      await bob.sync().catch(() => undefined)
      broken = false
      const reopened = await openHousehold(dev, identityFromInvite(seatOf(bob)), bob.household)
      if (!reopened) throw new Error('could not reopen')
      must(await reopened.sync())
      expect(reopened.view().epoch).toBe(2)
      await stillWorks(reopened)
    })

    it('keeps a phone’s writes after its clock was wrong for a moment', async () => {
      const { engine: alice } = await start('alice')
      const real = wall
      wall = real + 3 * 24 * 3600_000
      await alice.write('meal:soup', 'title', 'Wrong clock')
      wall = real + 1000
      await alice.write('meal:soup', 'title', 'Soup')
      must(await alice.sync())
      expect(title(alice)).toBe('Soup')
    })

    it('says the board is full, and stops saying so once a sync goes through', async () => {
      const { engine: alice } = await start('alice')
      const kv = server.board(alice.household)
      const meta = await kv.get<{ lastSeq: number }>('meta')
      await kv.put({ meta: { ...meta, lastSeq: 100_000 } })
      await alice.write('meal:soup', 'title', 'Soup')
      expect(errorOf(await alice.sync())).toBe('full')
      expect(alice.view().problem).toBe('full')
      online = false
      await alice.sync()
      expect(alice.view().problem).toBe('full')
      online = true
      await kv.put({ meta: { ...meta, lastSeq: 1 } })
      must(await alice.sync())
      expect(alice.view().problem).toBeUndefined()
    })

    it('joins with everything, however many pulls the history takes', async () => {
      const { engine: alice } = await start('alice')
      for (let i = 0; i < 60; i++) await alice.write(`meal:m${String(i)}`, 'title', 't')
      must(await alice.sync())
      const invite = must(await alice.invite('member'))
      const dev = device('slow')
      const relay = memoryRelay(server)
      // One record a page: fifty pulls, the most one sync takes, reach only part of it.
      const slow = {
        ...relay,
        pull: async (...args: Parameters<typeof relay.pull>) => {
          const got = await relay.pull(...args)
          return isOk(got) ? { ...got, value: got.value.slice(0, 1) } : got
        },
      }
      const late = must(await joinHousehold({ ...dev, relay: slow }, invite))
      expect(Object.keys(late.view().store)).toHaveLength(Object.keys(alice.view().store).length)
    })

    it('refuses a write the other devices would drop, instead of losing it later', async () => {
      const { engine: alice } = await start('alice')
      await expect(alice.write('meal:soup', 'title', 'x'.repeat(9000))).rejects.toThrow()
      expect(alice.view().pending).toBe(0)
      expect(title(alice)).toBeUndefined()
    })
  })

  it('refuses an invite whose board does not match', async () => {
    const { engine: alice } = await start('alice')
    const invite = must(await alice.invite('member'))
    const dev = device('mallory')
    const wrong = { ...invite, household: 'f'.repeat(64) }
    expect(isErr(await joinHousehold(dev, wrong))).toBe(true)
    expect(hexToBytes(invite.signSecretKey)).toHaveLength(32)
    expect(memberKeyOf(newIdentity(fakeRandom('x')))).toHaveLength(64)
  })

  it('sees what another Member wrote between its own pull and its own send', async () => {
    const { engine: alice } = await start('alice')
    const invite = must(await alice.invite('member'))
    const dev = device('bob')
    const relay = memoryRelay(server)
    let between: (() => Promise<void>) | undefined
    const racing = {
      ...relay,
      pull: async (...args: Parameters<typeof relay.pull>) => {
        const got = await relay.pull(...args)
        const run = between
        between = undefined
        await run?.()
        return got
      },
    }
    const bob = must(await joinHousehold({ ...dev, relay: racing }, invite))
    await bob.write('meal:stew', 'title', 'Stew')
    between = async () => {
      tick()
      await alice.write('meal:soup', 'title', 'Soup')
      must(await alice.sync())
    }
    must(await bob.sync())
    must(await bob.sync())
    expect(title(bob)).toBe('Soup')
  })

  it('takes a write at once while the relay has not answered, and keeps it through that sync', async () => {
    const { engine: alice, dev } = await start('alice')
    const { engine: bob } = await joinAs('bob', must(await alice.invite('member')))
    await bob.write('meal:stew', 'title', 'Stew')
    must(await bob.sync())
    let open: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      open = resolve
    })
    const relay = memoryRelay(server)
    const held = {
      ...relay,
      pull: async (...args: Parameters<typeof relay.pull>) => {
        await gate
        return relay.pull(...args)
      },
    }
    const reopened = await openHousehold(
      { ...dev, relay: held },
      identityFromInvite(seatOf(alice)),
      alice.household,
    )
    if (!reopened) throw new Error('could not reopen')
    const syncing = reopened.sync()
    await reopened.write('meal:soup', 'title', 'Soup')
    expect(title(reopened)).toBe('Soup')
    open()
    must(await syncing)
    expect(title(reopened)).toBe('Soup')
    expect(title(reopened, 'meal:stew')).toBe('Stew')
    must(await reopened.sync())
    expect(reopened.view().pending).toBe(0)
  })

  it('writes several fields of a row as one save', async () => {
    const { engine: alice, dev } = await start('alice')
    const sets: string[] = []
    const storage = dev.storage
    const counted: KeyValue = {
      get: storage.get,
      set: (k, v) => {
        sets.push(k)
        return storage.set(k, v)
      },
    }
    const reopened = await openHousehold(
      { ...dev, storage: counted },
      identityFromInvite(seatOf(alice)),
      alice.household,
    )
    if (!reopened) throw new Error('could not reopen')
    await reopened.writeMany('meal:soup', { title: 'Soup', servings: 4 })
    expect(sets).toHaveLength(1)
    expect(reopened.view().pending).toBe(2)
    expect(readField(reopened.view().store, 'meal:soup', 'servings')).toBe(4)
  })

  it('leaves the vault alone for a plain write, and saves once per event sent', async () => {
    const { engine: alice, dev } = await start('alice')
    const writes: string[] = []
    const watch = (kv: KeyValue, name: string): KeyValue => ({
      get: kv.get,
      set: (k, v) => {
        writes.push(name)
        return kv.set(k, v)
      },
    })
    const reopened = await openHousehold(
      { ...dev, storage: watch(dev.storage, 'storage'), vault: watch(dev.vault, 'vault') },
      identityFromInvite(seatOf(alice)),
      alice.household,
    )
    if (!reopened) throw new Error('could not reopen')
    await reopened.write('meal:soup', 'title', 'Soup')
    expect(writes).toEqual(['storage'])
    writes.length = 0
    must(await reopened.sync())
    expect(writes).toEqual(['storage'])
  })

  it('refuses a write too big for the relay to take, so it cannot block the ones after it', async () => {
    const { engine: alice } = await start('alice')
    const big = Array.from({ length: 10 }, () => 'x'.repeat(8000))
    await expect(alice.write('meal:soup', 'steps', big)).rejects.toThrow()
    expect(alice.view().pending).toBe(0)
    await alice.write('meal:soup', 'title', 'Soup')
    must(await alice.sync())
    expect(alice.view().pending).toBe(0)
  })
})
