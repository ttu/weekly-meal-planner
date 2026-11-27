import { z } from 'zod'

/**
 * Where the relay lives (ADR 0013). The app cannot sync without it, so a
 * missing one is an error at startup.
 *
 * Metro replaces `process.env.EXPO_PUBLIC_*` at each direct member access, so
 * the name must be written out here, not read from a `process.env` object.
 */
export const readRelayUrl = (): string => {
  const raw: unknown = process.env.EXPO_PUBLIC_RELAY_URL
  return z.url().parse(raw).replace(/\/$/, '')
}
