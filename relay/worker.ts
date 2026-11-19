import { checkCreation, recordCreation } from './core'
import { handleBoardCall } from './api'

/**
 * Cloudflare entry. One Durable Object per board (its storage is the board, and
 * it serialises the calls), plus one registry that counts board creations.
 * Types are declared here, not imported, so the app's type-check needs no
 * Workers typings.
 */
type Storage = Parameters<typeof checkCreation>[0]
type Stub = { fetch: (request: Request) => Promise<Response> }
type Namespace = { idFromName: (name: string) => unknown; get: (id: unknown) => Stub }
type State = { storage: Storage }
type Env = { BOARD: Namespace; GATE: Namespace }

const ROUTE = /^\/v1\/boards\/([^/]+)\/(create|append|rotate|pull)$/
/**
 * The app is served from another origin than the relay, so the browser asks
 * first. Access is by a bearer token in a header, never a cookie, so any origin
 * may call: knowing the token is the only thing that matters.
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400',
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })

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
  async fetch(request: Request): Promise<Response> {
    const record = new URL(request.url).pathname === '/record'
    try {
      await (record ? recordCreation : checkCreation)(this.state.storage, Date.now())
      return json(200, {})
    } catch {
      return json(429, { error: 'relay_busy' })
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (request.method !== 'POST' || !match) return json(404, { error: 'not_found' })
    const [, board = '', op = ''] = match
    const target = env.BOARD.get(env.BOARD.idFromName(decodeURIComponent(board)))
    if (op !== 'create') return target.fetch(request)
    const gate = env.GATE.get(env.GATE.idFromName('gate'))
    const open = await gate.fetch(new Request('https://gate/check'))
    if (open.status !== 200) return open
    const reply = await target.fetch(request)
    if (reply.status === 200) await gate.fetch(new Request('https://gate/record'))
    return reply
  },
}
