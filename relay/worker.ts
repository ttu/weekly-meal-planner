import { isBoard, releaseCreation, reserveCreation, RelayFailure } from './core'
import { handleBoardCall } from './api'

/**
 * Cloudflare entry. One Durable Object per board (its storage is the board, and
 * it serialises the calls), plus one registry that counts board creations.
 * Types are declared here, not imported, so the app's type-check needs no
 * Workers typings.
 */
type Storage = Parameters<typeof reserveCreation>[0]
type Stub = { fetch: (request: Request) => Promise<Response> }
type Namespace = { idFromName: (name: string) => unknown; get: (id: unknown) => Stub }
type State = { storage: Storage }
type Limiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> }
export type Env = { BOARD: Namespace; GATE: Namespace; LIMITER?: Limiter }
type Clock = () => number

const ROUTE = /^\/v1\/boards\/([^/]+)\/(create|append|rotate|pull)$/
/** The largest record is 64 KiB of hex; anything much bigger is not a call. */
const MAX_BODY = 200_000
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

/** The board and operation a path names, or undefined for a path that names none. */
const routeOf = (url: string): { board: string; op: string } | undefined => {
  const [, encoded = '', op = ''] = ROUTE.exec(new URL(url).pathname) ?? []
  try {
    const board = decodeURIComponent(encoded)
    return isBoard(board) ? { board, op } : undefined
  } catch {
    return undefined
  }
}

/** The body as text, or undefined once it passes `max`: never held whole when it is too big. */
const readCapped = async (request: Request, max: number): Promise<string | undefined> => {
  if (Number(request.headers.get('content-length') ?? 0) > max) return undefined
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return undefined
    }
    text += decoder.decode(value, { stream: true })
  }
}

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export class BoardObject {
  constructor(
    private readonly state: State,
    _env?: unknown,
    private readonly now: Clock = () => Date.now(),
  ) {}
  async fetch(request: Request): Promise<Response> {
    const route = routeOf(request.url)
    if (!route) return json(400, { error: 'relay_bad_request' })
    const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
    const body = parse(await request.text())
    const reply = await handleBoardCall(this.state.storage, { ...route, token, body }, this.now())
    return json(reply.status, reply.body)
  }
}

export class GateObject {
  constructor(
    private readonly state: State,
    _env?: unknown,
    private readonly now: Clock = () => Date.now(),
  ) {}
  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === '/release') {
      await releaseCreation(this.state.storage, parse(await request.text()))
      return json(200, {})
    }
    try {
      return json(200, await reserveCreation(this.state.storage, this.now()))
    } catch (e) {
      // Only the cap is "busy"; a storage failure is the relay's own error.
      if (e instanceof RelayFailure) return json(429, { error: e.message })
      throw e
    }
  }
}

const create = async (env: Env, board: Stub, call: Request): Promise<Response> => {
  const gate = env.GATE.get(env.GATE.idFromName('gate'))
  const reserved = await gate.fetch(new Request('https://gate/reserve', { method: 'POST' }))
  if (reserved.status !== 200) return reserved
  const reply = await board.fetch(call)
  if (reply.status !== 200) {
    const at = await reserved.text()
    await gate.fetch(new Request('https://gate/release', { method: 'POST', body: at }))
  }
  return reply
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (request.method !== 'POST' || !ROUTE.test(new URL(request.url).pathname))
      return json(404, { error: 'not_found' })
    const route = routeOf(request.url)
    if (!route) return json(400, { error: 'relay_bad_request' })
    // Every call, not only creation: each new board name wakes a Durable Object.
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    if (env.LIMITER && !(await env.LIMITER.limit({ key: ip })).success)
      return json(429, { error: 'relay_busy' })
    const body = await readCapped(request, MAX_BODY)
    if (body === undefined) return json(413, { error: 'relay_too_large' })
    // Handed on already read, so the board's object never sees more than MAX_BODY.
    const call = new Request(request.url, { method: 'POST', headers: request.headers, body })
    const board = env.BOARD.get(env.BOARD.idFromName(route.board))
    return route.op === 'create' ? create(env, board, call) : board.fetch(call)
  },
}
