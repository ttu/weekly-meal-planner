import { isErr, isOk, type Result } from '@/shared/types/result'
import { decrypt, encrypt, newEpochKey, newKeyPair, openKey, sealKey } from './crypto'
import { fakeRandom } from './fake-random'

const text = (s: string): Uint8Array => new TextEncoder().encode(s)
const ctx = { household: 'h1', epoch: 1 }

const must = <T, E>(result: Result<T, E>): T => {
  if (!isOk(result)) throw new Error('expected ok')
  return result.value
}

describe('encrypt and decrypt', () => {
  const random = fakeRandom('events')
  const key = newEpochKey(random)

  it('round-trips an event', () => {
    const result = decrypt(key, ctx, encrypt(key, ctx, text('soup'), random))
    expect(isOk(result) && new TextDecoder().decode(result.value)).toBe('soup')
  })

  it('never encrypts the same plaintext to the same bytes', () => {
    expect(encrypt(key, ctx, text('soup'), random)).not.toEqual(
      encrypt(key, ctx, text('soup'), random),
    )
  })

  it('does not contain the plaintext', () => {
    const sealed = encrypt(key, ctx, text('secret-recipe'), random)
    expect(new TextDecoder().decode(sealed)).not.toContain('secret-recipe')
  })

  it('refuses a different key, which is what a removed Member holds', () => {
    const sealed = encrypt(key, ctx, text('soup'), random)
    expect(isErr(decrypt(newEpochKey(random), ctx, sealed))).toBe(true)
  })

  it.each([
    ['another household', { household: 'h2', epoch: 1 }],
    ['another epoch', { household: 'h1', epoch: 2 }],
  ])('refuses ciphertext replayed into %s', (_name, other) => {
    expect(isErr(decrypt(key, other, encrypt(key, ctx, text('soup'), random)))).toBe(true)
  })

  it('refuses a flipped bit', () => {
    const sealed = encrypt(key, ctx, text('soup'), random)
    sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 1
    expect(isErr(decrypt(key, ctx, sealed))).toBe(true)
  })

  it.each([0, 10, 39])('refuses input of %i bytes without throwing', (length) => {
    expect(isErr(decrypt(key, ctx, new Uint8Array(length)))).toBe(true)
  })
})

describe('sealKey and openKey', () => {
  const random = fakeRandom('seal')
  const epochKey = newEpochKey(random)
  const member = newKeyPair(random)

  it('delivers the epoch key to its recipient', () => {
    const opened = openKey(
      must(sealKey(epochKey, ctx, member.publicKey, random)),
      ctx,
      member.secretKey,
    )
    expect(isOk(opened) && opened.value).toEqual(epochKey)
  })

  it('does not open for anyone else', () => {
    const stranger = newKeyPair(random)
    const sealed = must(sealKey(epochKey, ctx, member.publicKey, random))
    expect(isErr(openKey(sealed, ctx, stranger.secretKey))).toBe(true)
  })

  it.each([
    ['another household', { household: 'h2', epoch: 1 }],
    ['another epoch', { household: 'h1', epoch: 2 }],
  ])('does not open when replayed for %s', (_name, other) => {
    const sealed = must(sealKey(epochKey, ctx, member.publicKey, random))
    expect(isErr(openKey(sealed, other, member.secretKey))).toBe(true)
  })

  it('does not carry the key in the clear', () => {
    const sealed = must(sealKey(epochKey, ctx, member.publicKey, random))
    expect(Buffer.from(sealed).includes(Buffer.from(epochKey))).toBe(false)
  })

  it('refuses a tampered or truncated envelope without throwing', () => {
    const sealed = must(sealKey(epochKey, ctx, member.publicKey, random))
    sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 1
    expect(isErr(openKey(sealed, ctx, member.secretKey))).toBe(true)
    expect(isErr(openKey(new Uint8Array(20), ctx, member.secretKey))).toBe(true)
  })

  it('refuses a recipient key that is not a valid point, instead of throwing', () => {
    expect(isErr(sealKey(epochKey, ctx, new Uint8Array(32), random))).toBe(true)
    expect(isErr(sealKey(epochKey, ctx, new Uint8Array(5), random))).toBe(true)
  })
})
