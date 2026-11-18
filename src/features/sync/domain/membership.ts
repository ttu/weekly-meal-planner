import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { z } from 'zod'
import { err, ok, type Result } from '@/shared/types/result'
import { memberKeyOf, type Identity } from './identity'

/**
 * Who is in a Household, as a log of admin-signed operations. The relay gives
 * every replica the same order, and each operation names the one before it, so
 * every replica checks each operation against the same state and agrees.
 */

const key = z.string().regex(/^[0-9a-f]{64}$/)
const sealedKey = z.string().regex(/^([0-9a-f]{2}){1,256}$/)
const role = z.enum(['admin', 'member'])
const publicKeys = z.object({ sign: key, box: key })
const base = { household: z.string().min(1).max(128), prev: key.optional() }

const body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create'), ...base, admin: publicKeys, epoch: z.literal(1) }),
  z.object({
    kind: z.literal('add'),
    ...base,
    member: publicKeys.extend({ role }),
    keys: z.array(z.object({ epoch: z.int().min(1), sealed: sealedKey })).max(1000),
  }),
  z.object({ kind: z.literal('setRole'), ...base, member: key, role }),
  z.object({
    kind: z.literal('remove'),
    ...base,
    member: key,
    epoch: z.int().min(2),
    keys: z.array(z.object({ member: key, sealed: sealedKey })).max(1000),
  }),
])

const signedOp = z.object({
  body,
  signer: key,
  signature: z.string().regex(/^[0-9a-f]{128}$/),
})

export type OpBody = z.infer<typeof body>
export type SignedOp = z.infer<typeof signedOp>
export type Role = z.infer<typeof role>

export type Membership = {
  readonly household: string
  readonly epoch: number
  /** The id of the last operation applied; the next operation must name it. */
  readonly head: string
  /** Keyed by the Member's signing key. */
  readonly members: { readonly [signKey: string]: { readonly box: string; readonly role: Role } }
}

export type MembershipError =
  | 'badSignature'
  | 'notGenesis'
  | 'wrongHousehold'
  | 'wrongPrev'
  | 'notMember'
  | 'notAdmin'
  | 'alreadyMember'
  | 'unknownMember'
  | 'badKeyset'
  | 'wrongEpoch'
  | 'lastAdmin'

const encoder = new TextEncoder()

/** One fixed field order per kind, so signer and verifier hash identical bytes. */
const encodeBody = (b: OpBody): Uint8Array => {
  const head = ['menami/v1/membership', b.kind, b.household, b.prev ?? '']
  switch (b.kind) {
    case 'create':
      return encoder.encode(JSON.stringify([...head, b.admin.sign, b.admin.box, b.epoch]))
    case 'add':
      return encoder.encode(
        JSON.stringify([
          ...head,
          b.member.sign,
          b.member.box,
          b.member.role,
          b.keys.map((k) => [k.epoch, k.sealed]),
        ]),
      )
    case 'setRole':
      return encoder.encode(JSON.stringify([...head, b.member, b.role]))
    case 'remove':
      return encoder.encode(
        JSON.stringify([...head, b.member, b.epoch, b.keys.map((k) => [k.member, k.sealed])]),
      )
  }
}

export const signOp = (opBody: OpBody, signer: Identity): SignedOp => ({
  body: opBody,
  signer: memberKeyOf(signer),
  signature: bytesToHex(ed25519.sign(encodeBody(opBody), signer.signSecretKey)),
})

export const opId = (op: SignedOp): string =>
  bytesToHex(sha256(new Uint8Array([...encodeBody(op.body), ...hexToBytes(op.signature)])))

/** Parse an operation that came off the wire. Never throws. */
export const parseSignedOp = (input: unknown): Result<SignedOp, 'malformed'> => {
  const parsed = signedOp.safeParse(input)
  return parsed.success ? ok(parsed.data) : err('malformed')
}

const validSignature = (op: SignedOp): boolean => {
  try {
    return ed25519.verify(hexToBytes(op.signature), encodeBody(op.body), hexToBytes(op.signer))
  } catch {
    return false
  }
}

const adminCount = (members: Membership['members']): number =>
  Object.values(members).filter((m) => m.role === 'admin').length

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && new Set(a).size === a.length && b.every((x) => a.includes(x))

const withoutKey = (members: Membership['members'], member: string): Membership['members'] =>
  Object.fromEntries(Object.entries(members).filter(([k]) => k !== member))

const own = (members: Membership['members'], member: string) =>
  Object.hasOwn(members, member) ? members[member] : undefined

type Result_ = Result<Membership, MembershipError>
type Members = Membership['members']
type Step<K extends OpBody['kind']> = (
  state: Membership,
  b: Extract<OpBody, { kind: K }>,
  next: (members: Members, epoch?: number) => Membership,
) => Result_

const create = (op: SignedOp, b: Extract<OpBody, { kind: 'create' }>): Result_ =>
  op.signer === b.admin.sign
    ? ok({
        household: b.household,
        epoch: 1,
        head: opId(op),
        members: { [b.admin.sign]: { box: b.admin.box, role: 'admin' } },
      })
    : err('badSignature')

const add: Step<'add'> = (state, b, next) => {
  if (own(state.members, b.member.sign)) return err('alreadyMember')
  const epochs = b.keys.map((k) => String(k.epoch))
  const wanted = Array.from({ length: state.epoch }, (_, i) => String(i + 1))
  if (!sameSet(epochs, wanted)) return err('badKeyset')
  const entry = { box: b.member.box, role: b.member.role }
  return ok(next({ ...state.members, [b.member.sign]: entry }))
}

const setRole: Step<'setRole'> = (state, b, next) => {
  const target = own(state.members, b.member)
  if (!target) return err('unknownMember')
  const members = { ...state.members, [b.member]: { ...target, role: b.role } }
  return adminCount(members) === 0 ? err('lastAdmin') : ok(next(members))
}

const remove: Step<'remove'> = (state, b, next) => {
  if (!own(state.members, b.member)) return err('unknownMember')
  if (b.epoch !== state.epoch + 1) return err('wrongEpoch')
  const members = withoutKey(state.members, b.member)
  if (adminCount(members) === 0) return err('lastAdmin')
  const delivered = b.keys.map((k) => k.member)
  return sameSet(delivered, Object.keys(members)) ? ok(next(members, b.epoch)) : err('badKeyset')
}

/** The pure core: the current state and one operation in, the next state or the reason it is refused. */
export const applyOp = (state: Membership | undefined, op: SignedOp): Result_ => {
  if (!validSignature(op)) return err('badSignature')
  const b = op.body
  if (!state) return b.kind === 'create' ? create(op, b) : err('notGenesis')
  if (b.household !== state.household) return err('wrongHousehold')
  if (b.prev !== state.head) return err('wrongPrev')
  const signer = own(state.members, op.signer)
  if (!signer) return err('notMember')
  if (signer.role !== 'admin') return err('notAdmin')
  const next = (members: Members, epoch = state.epoch): Membership => ({
    ...state,
    members,
    epoch,
    head: opId(op),
  })
  switch (b.kind) {
    case 'create':
      return err('wrongPrev')
    case 'add':
      return add(state, b, next)
    case 'setRole':
      return setRole(state, b, next)
    case 'remove':
      return remove(state, b, next)
  }
}
