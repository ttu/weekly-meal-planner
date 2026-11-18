import { err, ok } from '@/shared/types/result'
import {
  relayErrorFromMessage,
  type Relay,
  type RelayKind,
  type RelayRecord,
} from '@/features/sync/domain/relay'
import type { TestDb } from './harness'

type Stamp = { seq: number; received_at: number }
type Row = { seq: number; kind: RelayKind; epoch: number; payload: string; received_at: number }

/** The real relay SQL, behind the same interface the app uses. Tests run through this. */
export const pgliteRelay = (db: TestDb, online: () => boolean = () => true): Relay => {
  const call = async <T>(query: string, params: unknown[]) => {
    if (!online()) return err('offline' as const)
    try {
      await db.asAnon()
      return ok((await db.sql(query, params)) as T[])
    } catch (e) {
      return err(relayErrorFromMessage(e instanceof Error ? e.message : ''))
    }
  }
  const record = (kind: RelayKind, epoch: number, payload: string, s: Stamp | undefined) =>
    s
      ? ok<RelayRecord>({ seq: s.seq, kind, epoch, payload, receivedAt: s.received_at })
      : err('rejected' as const)
  const stamped = async (
    query: string,
    params: unknown[],
    kind: RelayKind,
    epoch: number,
    payload: string,
  ) => {
    const result = await call<Stamp>(query, params)
    return result.kind === 'err' ? result : record(kind, epoch, payload, result.value[0])
  }
  return {
    create: (board, token, payload) =>
      stamped(
        'select * from relay_create($1, $2, $3)',
        [board, token, payload],
        'membership',
        1,
        payload,
      ),
    append: (board, token, epoch, kind, payload) =>
      stamped(
        'select * from relay_append($1, $2, $3, $4, $5)',
        [board, token, epoch, kind, payload],
        kind,
        epoch,
        payload,
      ),
    rotate: async (board, token, newToken, payload) => {
      const result = await call<Stamp>('select * from relay_rotate($1, $2, $3, $4)', [
        board,
        token,
        newToken,
        payload,
      ])
      // The epoch is only known to the caller, so rotate reports epoch 0 and the next pull has the truth.
      return result.kind === 'err' ? result : record('membership', 0, payload, result.value[0])
    },
    pull: async (board, token, afterSeq) => {
      const result = await call<Row>('select * from relay_pull($1, $2, $3, 500)', [
        board,
        token,
        afterSeq,
      ])
      return result.kind === 'err'
        ? result
        : ok(
            result.value.map((r) => ({
              seq: r.seq,
              kind: r.kind,
              epoch: r.epoch,
              payload: r.payload,
              receivedAt: r.received_at,
            })),
          )
    },
  }
}
