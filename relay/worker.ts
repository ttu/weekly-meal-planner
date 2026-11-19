import { admitCreation } from './core'
import { handleBoardCall } from './api'

/**
 * Cloudflare entry. One Durable Object per board (its storage is the board, and
 * it serialises the calls), plus one registry that counts board creations.
 * Types are declared here, not imported, so the app's type-check needs no
 * Workers typings.
 */
type Storage = Parameters<typeof admitCreation>[0]
type Stub = { fetch: (request: Request) => Promise<Response> }
type Namespace = { idFromName: (name: string) => unknown; get: (id: unknown) => Stub }
type State = { storage: Storage }
type Env = { BOARD: Namespace; GATE: Namespace }

const ROUTE = /^\/v1\/boards\/([^/]+)\/(create|append|rotate|pull)$/
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const callOf = async (request: Request, board: string, op: string) => {
  const body: unknown = await request.json().catch(() => undefined)
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
  return { op, board, token, body }
}

export class BoardObject {
  constructor(private readonly state: State) {}
  async fetch(request: Request): Promise<Response> {
    const [, board = '', op = ''] = ROUTE.exec(new URL(request.url).pathname) ?? []
    const reply = await handleBoardCall(
      this.state.storage,
      await callOf(request, decodeURIComponent(board), op),
      Date.now(),
    )
    return json(reply.status, reply.body)
  }
}

export class GateObject {
  constructor(private readonly state: State) {}
  async fetch(): Promise<Response> {
    try {
      await admitCreation(this.state.storage, Date.now())
      return json(200, {})
    } catch {
      return json(429, { error: 'relay_busy' })
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (request.method !== 'POST' || !match) return json(404, { error: 'not_found' })
    const [, board = '', op = ''] = match
    if (op === 'create') {
      const admitted = await env.GATE.get(env.GATE.idFromName('gate')).fetch(request.clone())
      if (admitted.status !== 200) return admitted
    }
    return env.BOARD.get(env.BOARD.idFromName(decodeURIComponent(board))).fetch(request)
  },
}
