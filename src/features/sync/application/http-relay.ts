import { z } from 'zod'
import { err, ok, type Result } from '@/shared/types/result'
import {
  relayErrorFromMessage,
  type Relay,
  type RelayError,
  type RelayKind,
  type RelayRecord,
} from '../domain/relay'

/** The part of `fetch` this needs, so tests and the app can each bring their own. */
export type Fetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>

const stamp = z.object({
  seq: z.number().int(),
  epoch: z.number().int(),
  receivedAt: z.number().int(),
})
const pulled = z.object({
  records: z.array(stamp.extend({ kind: z.enum(['membership', 'event']), payload: z.string() })),
})
const refusal = z.object({ error: z.string() })

/** The relay over HTTP (`relay/api.ts` is the other end). */
export const httpRelay = (baseUrl: string, fetcher: Fetch): Relay => {
  const call = async <T>(
    op: string,
    board: string,
    token: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<Result<T, RelayError>> => {
    try {
      const reply = await fetcher(`${baseUrl}/v1/boards/${encodeURIComponent(board)}/${op}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const json = await reply.json()
      if (reply.status >= 500) return err('offline')
      if (reply.status !== 200) {
        const refused = refusal.safeParse(json)
        return err(refused.success ? relayErrorFromMessage(refused.data.error) : 'rejected')
      }
      const parsed = schema.safeParse(json)
      return parsed.success ? ok(parsed.data) : err('rejected')
    } catch {
      return err('offline')
    }
  }
  const stamped = async (
    op: string,
    board: string,
    token: string,
    body: Record<string, unknown>,
    kind: RelayKind,
    payload: string,
  ): Promise<Result<RelayRecord, RelayError>> => {
    const result = await call(op, board, token, { ...body, payload }, stamp)
    return result.kind === 'err' ? result : ok({ ...result.value, kind, payload })
  }
  return {
    create: (board, token, payload) => stamped('create', board, token, {}, 'membership', payload),
    append: (board, token, epoch, kind, payload) =>
      stamped('append', board, token, { epoch, kind }, kind, payload),
    rotate: (board, token, newToken, payload) =>
      stamped('rotate', board, token, { newToken }, 'membership', payload),
    pull: async (board, token, after) => {
      const result = await call('pull', board, token, { after }, pulled)
      return result.kind === 'err' ? result : ok(result.value.records)
    },
  }
}
