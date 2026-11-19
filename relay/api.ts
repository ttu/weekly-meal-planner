import {
  checkCreation,
  recordCreation,
  appendRecord,
  createBoard,
  pullRecords,
  rotateBoard,
  RelayFailure,
  type Kv,
  type Reason,
} from './core'

/**
 * The wire: `POST /v1/boards/<board>/<op>`, the token in `Authorization: Bearer`,
 * a JSON body, a JSON reply. A refusal is `{ error: 'relay_<reason>' }`.
 */
export type Call = {
  readonly op: string
  readonly board: string
  readonly token: string | undefined
  readonly body: unknown
}
export type Reply = { readonly status: number; readonly body: unknown }

const STATUS: Record<Reason, number> = {
  forbidden: 403,
  epoch: 409,
  exists: 409,
  same_token: 409,
  busy: 429,
  full: 413,
  bad_request: 400,
}

const fields = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null ? Object.fromEntries(Object.entries(body)) : {}

const run = async (kv: Kv, call: Call, now: number): Promise<unknown> => {
  const b = fields(call.body)
  switch (call.op) {
    case 'create':
      return createBoard(kv, call.board, call.token, b.payload, now)
    case 'append':
      return appendRecord(kv, call.token, b.epoch, b.kind, b.payload, now)
    case 'rotate':
      return rotateBoard(kv, call.token, b.newToken, b.payload, now)
    case 'pull':
      return { records: await pullRecords(kv, call.token, b.after) }
    default:
      throw new RelayFailure('bad_request')
  }
}

/** One board's call, against that board's storage. Never throws for a refusal. */
export const handleBoardCall = async (kv: Kv, call: Call, now: number): Promise<Reply> => {
  try {
    return { status: 200, body: await run(kv, call, now) }
  } catch (e) {
    if (e instanceof RelayFailure) return { status: STATUS[e.reason], body: { error: e.message } }
    throw e
  }
}

/** The whole relay over plain storage: what the tests run, and what the Worker splits across objects. */
export const handleCall = async (
  directory: { readonly board: (id: string) => Kv; readonly gate: Kv },
  call: Call,
  now: number,
): Promise<Reply> => {
  if (call.op !== 'create') return handleBoardCall(directory.board(call.board), call, now)
  try {
    await checkCreation(directory.gate, now)
  } catch (e) {
    if (e instanceof RelayFailure) return { status: STATUS[e.reason], body: { error: e.message } }
    throw e
  }
  const reply = await handleBoardCall(directory.board(call.board), call, now)
  if (reply.status === 200) await recordCreation(directory.gate, now)
  return reply
}
