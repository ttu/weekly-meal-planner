import { isErr, isOk, type Result } from '@/shared/types/result'
import { fakeRandom } from './fake-random'
import { memberKeyOf, newIdentity, type Identity } from './identity'
import {
  applyOp,
  parseSignedOp,
  signOp,
  type Membership,
  type OpBody,
  type SignedOp,
} from './membership'
import { bytesToHex } from '@noble/hashes/utils'

const random = fakeRandom('membership')
const pub = (i: Identity) => ({ sign: memberKeyOf(i), box: bytesToHex(i.box.publicKey) })
const sealed = (n: number) => 'ab'.repeat(40 + n)

const must = <T, E>(r: Result<T, E>): T => {
  if (!isOk(r)) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`)
  return r.value
}
const errorOf = <T, E>(r: Result<T, E>): E | undefined => (isErr(r) ? r.error : undefined)

const alice = newIdentity(random)
const bob = newIdentity(random)
const carol = newIdentity(random)
const mallory = newIdentity(random)

const genesis = (): SignedOp =>
  signOp({ kind: 'create', household: 'h1', prev: undefined, admin: pub(alice), epoch: 1 }, alice)

const board = (): Membership => must(applyOp(undefined, genesis()))

/** An op built against `state`, so tests do not repeat the head and household. */
const op = (state: Membership, signer: Identity, body: Record<string, unknown>): SignedOp =>
  signOp({ household: state.household, prev: state.head, ...body } as OpBody, signer)

const add = (
  state: Membership,
  signer: Identity,
  who: Identity,
  role: 'admin' | 'member' = 'member',
) =>
  op(state, signer, {
    kind: 'add',
    member: { ...pub(who), role },
    keys: Array.from({ length: state.epoch }, (_, i) => ({ epoch: i + 1, sealed: sealed(i) })),
  })

const remove = (state: Membership, signer: Identity, who: Identity, keep: Identity[]) =>
  op(state, signer, {
    kind: 'remove',
    member: memberKeyOf(who),
    epoch: state.epoch + 1,
    keys: keep.map((k) => ({ member: memberKeyOf(k), sealed: sealed(1) })),
  })

describe('creating a board', () => {
  it('makes the creator its only admin at epoch 1', () => {
    const state = board()
    expect(state.epoch).toBe(1)
    expect(state.members[memberKeyOf(alice)]?.role).toBe('admin')
    expect(Object.keys(state.members)).toHaveLength(1)
  })

  it('must be signed by the admin it names', () => {
    const forged = signOp(
      { kind: 'create', household: 'h1', prev: undefined, admin: pub(alice), epoch: 1 },
      mallory,
    )
    expect(errorOf(applyOp(undefined, forged))).toBe('badSignature')
  })

  it('cannot be applied twice, which would let someone restart the board', () => {
    expect(errorOf(applyOp(board(), genesis()))).toBe('wrongPrev')
  })

  it('must come first', () => {
    const state = board()
    expect(errorOf(applyOp(undefined, add(state, alice, bob)))).toBe('notGenesis')
  })
})

describe('adding Members', () => {
  it('lets an admin add a Member who then belongs', () => {
    const state = must(applyOp(board(), add(board(), alice, bob)))
    expect(state.members[memberKeyOf(bob)]?.role).toBe('member')
  })

  it('refuses a plain Member', () => {
    const s = must(applyOp(board(), add(board(), alice, bob)))
    expect(errorOf(applyOp(s, add(s, bob, carol)))).toBe('notAdmin')
  })

  it('refuses someone who was never a Member', () => {
    expect(errorOf(applyOp(board(), add(board(), mallory, carol)))).toBe('notMember')
  })

  it('refuses a body altered after signing', () => {
    const real = add(board(), alice, bob)
    const tampered = { ...real, body: { ...real.body, member: { ...pub(mallory), role: 'admin' } } }
    expect(errorOf(applyOp(board(), tampered as SignedOp))).toBe('badSignature')
  })

  it('refuses an old op replayed later, because it no longer follows the head', () => {
    const s0 = board()
    const addBob = add(s0, alice, bob)
    const s1 = must(applyOp(s0, addBob))
    const s2 = must(applyOp(s1, remove(s1, alice, bob, [alice])))
    expect(errorOf(applyOp(s2, addBob))).toBe('wrongPrev')
  })

  it('refuses an op for another Household', () => {
    const s = board()
    const other = signOp(
      {
        kind: 'add',
        household: 'h2',
        prev: s.head,
        member: { ...pub(bob), role: 'member' },
        keys: [{ epoch: 1, sealed: sealed(0) }],
      },
      alice,
    )
    expect(errorOf(applyOp(s, other))).toBe('wrongHousehold')
  })

  it('refuses a Member who is already in', () => {
    const s = must(applyOp(board(), add(board(), alice, bob)))
    expect(errorOf(applyOp(s, add(s, alice, bob)))).toBe('alreadyMember')
  })

  it('needs a key for every epoch so far, or the newcomer could not read history', () => {
    const s0 = board()
    const s1 = must(applyOp(s0, add(s0, alice, bob)))
    const s2 = must(applyOp(s1, remove(s1, alice, bob, [alice])))
    const short = op(s2, alice, {
      kind: 'add',
      member: { ...pub(carol), role: 'member' },
      keys: [{ epoch: 2, sealed: sealed(0) }],
    })
    expect(errorOf(applyOp(s2, short))).toBe('badKeyset')
    expect(isOk(applyOp(s2, add(s2, alice, carol)))).toBe(true)
  })
})

describe('roles', () => {
  const withBob = () => must(applyOp(board(), add(board(), alice, bob)))

  it('lets an admin promote a Member to admin', () => {
    const s = withBob()
    const promoted = must(
      applyOp(s, op(s, alice, { kind: 'setRole', member: memberKeyOf(bob), role: 'admin' })),
    )
    expect(promoted.members[memberKeyOf(bob)]?.role).toBe('admin')
  })

  it('lets the new admin hand over the role by demoting the first', () => {
    const s = withBob()
    const s1 = must(
      applyOp(s, op(s, alice, { kind: 'setRole', member: memberKeyOf(bob), role: 'admin' })),
    )
    const s2 = must(
      applyOp(s1, op(s1, bob, { kind: 'setRole', member: memberKeyOf(alice), role: 'member' })),
    )
    expect(s2.members[memberKeyOf(alice)]?.role).toBe('member')
  })

  it('never leaves a board without an admin', () => {
    const s = board()
    const demote = op(s, alice, { kind: 'setRole', member: memberKeyOf(alice), role: 'member' })
    expect(errorOf(applyOp(s, demote))).toBe('lastAdmin')
  })

  it('refuses a plain Member promoting themselves', () => {
    const s = withBob()
    const grab = op(s, bob, { kind: 'setRole', member: memberKeyOf(bob), role: 'admin' })
    expect(errorOf(applyOp(s, grab))).toBe('notAdmin')
  })

  it('refuses a role for someone who is not a Member', () => {
    const s = board()
    const ghost = op(s, alice, { kind: 'setRole', member: memberKeyOf(mallory), role: 'admin' })
    expect(errorOf(applyOp(s, ghost))).toBe('unknownMember')
  })
})

describe('removing Members', () => {
  const full = () => {
    const s0 = board()
    const s1 = must(applyOp(s0, add(s0, alice, bob)))
    return must(applyOp(s1, add(s1, alice, carol)))
  }

  it('starts a new epoch and drops the Member', () => {
    const s = full()
    const after = must(applyOp(s, remove(s, alice, bob, [alice, carol])))
    expect(after.epoch).toBe(2)
    expect(after.members[memberKeyOf(bob)]).toBeUndefined()
  })

  it('shuts the removed Member out of every later op', () => {
    const s = full()
    const after = must(applyOp(s, remove(s, alice, bob, [alice, carol])))
    expect(errorOf(applyOp(after, add(after, bob, mallory)))).toBe('notMember')
  })

  it('refuses a plain Member removing someone', () => {
    const s = full()
    expect(errorOf(applyOp(s, remove(s, bob, carol, [alice, bob])))).toBe('notAdmin')
  })

  it('must deliver the new key to exactly the remaining Members', () => {
    const s = full()
    expect(errorOf(applyOp(s, remove(s, alice, bob, [alice])))).toBe('badKeyset')
    expect(errorOf(applyOp(s, remove(s, alice, bob, [alice, carol, bob])))).toBe('badKeyset')
    expect(errorOf(applyOp(s, remove(s, alice, bob, [alice, carol, mallory])))).toBe('badKeyset')
  })

  it('refuses duplicate deliveries to one Member', () => {
    const s = full()
    expect(errorOf(applyOp(s, remove(s, alice, bob, [alice, carol, carol])))).toBe('badKeyset')
  })

  it('must move to the next epoch exactly', () => {
    const s = full()
    const skip = op(s, alice, {
      kind: 'remove',
      member: memberKeyOf(bob),
      epoch: 5,
      keys: [alice, carol].map((k) => ({ member: memberKeyOf(k), sealed: sealed(1) })),
    })
    expect(errorOf(applyOp(s, skip))).toBe('wrongEpoch')
  })

  it('refuses removing the last admin', () => {
    const s = full()
    expect(errorOf(applyOp(s, remove(s, alice, alice, [bob, carol])))).toBe('lastAdmin')
  })

  it('lets any admin cut off any Member, including another admin', () => {
    const s = full()
    const s1 = must(
      applyOp(s, op(s, alice, { kind: 'setRole', member: memberKeyOf(bob), role: 'admin' })),
    )
    const s2 = must(applyOp(s1, remove(s1, bob, alice, [bob, carol])))
    expect(s2.members[memberKeyOf(alice)]).toBeUndefined()
  })

  it('refuses removing someone who is not a Member', () => {
    const s = full()
    expect(errorOf(applyOp(s, remove(s, alice, mallory, [alice, bob, carol])))).toBe(
      'unknownMember',
    )
  })
})

describe('parseSignedOp on untrusted input', () => {
  it('round-trips a real op through JSON', () => {
    const real = genesis()
    expect(isOk(parseSignedOp(JSON.parse(JSON.stringify(real))))).toBe(true)
  })

  it.each([null, 7, 'x', {}, { body: {}, signer: 'a', signature: 'b' }])(
    'rejects %j without throwing',
    (value) => {
      expect(isErr(parseSignedOp(value))).toBe(true)
    },
  )

  it('rejects keys that are not 32 bytes of hex', () => {
    const real = genesis()
    const bad = { ...real, signer: 'zz'.repeat(32) }
    expect(isErr(parseSignedOp(bad))).toBe(true)
  })

  it('rejects an unknown role', () => {
    const s = board()
    const real = add(s, alice, bob)
    const bad = { ...real, body: { ...real.body, member: { ...pub(bob), role: 'owner' } } }
    expect(isErr(parseSignedOp(bad))).toBe(true)
  })
})
