import { z } from 'zod'
import { err, ok, type Result } from '@/shared/types/result'
import type { FieldValue } from './store'

const value: z.ZodType<FieldValue> = z.lazy(() =>
  z.union([
    z.string().max(8192),
    z.number().refine(Number.isFinite),
    z.boolean(),
    z.array(value).max(500),
    z.record(z.string().max(128), value),
  ]),
)

export const hlcSchema = z.object({
  wall: z.number(),
  counter: z.number(),
  node: z.string(),
})

/** What is encrypted inside an event record. `receivedAt` is not here: the relay adds it. */
export const eventBody = z.object({
  id: z.string().min(1).max(64),
  hlc: hlcSchema,
  entity: z.string(),
  field: z.string(),
  value,
})

export type EventBody = z.infer<typeof eventBody>
export { value as fieldValueSchema }

/** Decrypted bytes off the wire, to an event. Hostile input: never throws. */
export const decodeEvent = (bytes: Uint8Array): Result<EventBody, 'malformed'> => {
  try {
    const parsed = eventBody.safeParse(JSON.parse(new TextDecoder().decode(bytes)))
    return parsed.success ? ok(parsed.data) : err('malformed')
  } catch {
    return err('malformed')
  }
}

export const encodeEvent = (event: EventBody): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(event))
