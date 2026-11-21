import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { x25519 } from '@noble/curves/ed25519'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import { brand, type Brand } from '@/shared/types/brand'
import { err, ok, type Result } from '@/shared/types/result'

/** Secure randomness is a system boundary: the platform supplies it, tests fake it. */
export type Random = (length: number) => Uint8Array

/** The symmetric key one epoch of a Household's events is encrypted under. */
export type EpochKey = Brand<Uint8Array, 'EpochKey'>
export type KeyPair = { readonly secretKey: Uint8Array; readonly publicKey: Uint8Array }

/** What a ciphertext is bound to, so it cannot be replayed into another Household or epoch. */
export type CryptoContext = { readonly household: string; readonly epoch: number }

const KEY_BYTES = 32
const NONCE_BYTES = 24
const TAG_BYTES = 16

const aad = (purpose: string, c: CryptoContext): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(['menami/v1', purpose, c.household, c.epoch]))

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export const newEpochKey = (random: Random): EpochKey => brand(random(KEY_BYTES))

export const newKeyPair = (random: Random): KeyPair => {
  const secretKey = random(KEY_BYTES)
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) }
}

/** How long `encrypt` makes a plaintext of `length` bytes. */
export const sealedLength = (length: number): number => NONCE_BYTES + length + TAG_BYTES

/** Output is `nonce || ciphertext+tag`. */
export const encrypt = (
  key: EpochKey,
  context: CryptoContext,
  plaintext: Uint8Array,
  random: Random,
): Uint8Array => {
  const nonce = random(NONCE_BYTES)
  return concat(nonce, xchacha20poly1305(key, nonce, aad('event', context)).encrypt(plaintext))
}

export const decrypt = (
  key: EpochKey,
  context: CryptoContext,
  sealed: Uint8Array,
): Result<Uint8Array, 'undecryptable'> => {
  if (sealed.length < NONCE_BYTES + TAG_BYTES) return err('undecryptable')
  try {
    const nonce = sealed.subarray(0, NONCE_BYTES)
    const body = sealed.subarray(NONCE_BYTES)
    return ok(xchacha20poly1305(key, nonce, aad('event', context)).decrypt(body))
  } catch {
    return err('undecryptable')
  }
}

const wrappingKey = (
  shared: Uint8Array,
  ephemeral: Uint8Array,
  recipient: Uint8Array,
  c: CryptoContext,
) => hkdf(sha256, shared, concat(ephemeral, recipient), aad('key-wrap', c), KEY_BYTES)

/**
 * Seals an epoch key to one Member's public key: `ephemeralPublic || nonce || ciphertext+tag`.
 * A fresh ephemeral key per seal means no long-lived secret signs a delivery.
 */
export const sealKey = (
  epochKey: EpochKey,
  context: CryptoContext,
  recipientPublicKey: Uint8Array,
  random: Random,
): Result<Uint8Array, 'badRecipientKey'> => {
  try {
    const ephemeral = newKeyPair(random)
    const shared = x25519.getSharedSecret(ephemeral.secretKey, recipientPublicKey)
    const wrap = wrappingKey(shared, ephemeral.publicKey, recipientPublicKey, context)
    const nonce = random(NONCE_BYTES)
    const body = xchacha20poly1305(wrap, nonce, aad('key-wrap', context)).encrypt(epochKey)
    return ok(concat(ephemeral.publicKey, nonce, body))
  } catch {
    return err('badRecipientKey')
  }
}

export const openKey = (
  sealed: Uint8Array,
  context: CryptoContext,
  recipientSecretKey: Uint8Array,
): Result<EpochKey, 'unopenable'> => {
  if (sealed.length < KEY_BYTES + NONCE_BYTES + KEY_BYTES + TAG_BYTES) return err('unopenable')
  try {
    const ephemeral = sealed.subarray(0, KEY_BYTES)
    const nonce = sealed.subarray(KEY_BYTES, KEY_BYTES + NONCE_BYTES)
    const body = sealed.subarray(KEY_BYTES + NONCE_BYTES)
    const shared = x25519.getSharedSecret(recipientSecretKey, ephemeral)
    const recipientPublic = x25519.getPublicKey(recipientSecretKey)
    const wrap = wrappingKey(shared, ephemeral, recipientPublic, context)
    const key = xchacha20poly1305(wrap, nonce, aad('key-wrap', context)).decrypt(body)
    return key.length === KEY_BYTES ? ok(brand(key)) : err('unopenable')
  } catch {
    return err('unopenable')
  }
}
