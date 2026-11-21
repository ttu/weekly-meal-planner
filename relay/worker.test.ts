import { memoryDirectory, memoryEnv } from './memory'
import worker, { type Env } from './worker'

const BOARD = 'board-aaaaaaaa'
const TOKEN = 'a'.repeat(64)

const send = (env: Env, path: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://relay.test${path}`, { method: 'POST', ...init }), env)
const create = (env: Env, board = BOARD) =>
  send(env, `/v1/boards/${board}/create`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ payload: 'genesis' }),
  })

describe('the Worker entry', () => {
  const fresh = () => {
    const directory = memoryDirectory()
    return { directory, env: memoryEnv(directory) }
  }

  it('answers the browser’s preflight so the app on another origin can call it', async () => {
    const reply = await send(fresh().env, `/v1/boards/${BOARD}/append`, { method: 'OPTIONS' })
    expect(reply.status).toBe(204)
    expect(reply.headers.get('access-control-allow-origin')).toBe('*')
    expect(reply.headers.get('access-control-allow-headers')).toMatch(/authorization/)
  })

  it('answers anything that is not a board call with a 404 the browser may read', async () => {
    const { env } = fresh()
    const reply = await send(env, '/nope')
    expect(reply.status).toBe(404)
    expect(reply.headers.get('access-control-allow-origin')).toBe('*')
    expect((await send(env, `/v1/boards/${BOARD}/pull`, { method: 'GET' })).status).toBe(404)
  })

  it('refuses a board name it cannot decode or that is not a board name, without waking a board', async () => {
    const { env, directory } = fresh()
    expect((await send(env, '/v1/boards/%E0%A4%A/pull')).status).toBe(400)
    expect((await send(env, '/v1/boards/x/pull')).status).toBe(400)
    expect(directory.boards.size).toBe(0)
  })

  it('refuses a body far bigger than any record before a board reads it', async () => {
    const { env, directory } = fresh()
    const reply = await send(env, `/v1/boards/${BOARD}/append`, { body: 'x'.repeat(300_000) })
    expect(reply.status).toBe(413)
    expect(directory.boards.size).toBe(0)
  })

  it('turns callers away once the rate limit says so', async () => {
    const directory = memoryDirectory()
    const keys: string[] = []
    const env = memoryEnv(directory, undefined, {
      limit: ({ key }) => {
        keys.push(key)
        return Promise.resolve({ success: false })
      },
    })
    const reply = await send(env, `/v1/boards/${BOARD}/pull`, {
      headers: { 'cf-connecting-ip': '203.0.113.7' },
    })
    expect(reply.status).toBe(429)
    expect(keys).toEqual(['203.0.113.7'])
  })

  it('gives back the creation quota when a board is not made', async () => {
    const { env, directory } = fresh()
    expect((await create(env)).status).toBe(200)
    expect((await create(env)).status).toBe(409)
    expect(await directory.gate.get<number[]>('created')).toHaveLength(1)
  })

  it('reports a broken registry as its own failure, not as busy', async () => {
    const directory = memoryDirectory()
    directory.gate.get = () => Promise.reject(new Error('storage down'))
    await expect(create(memoryEnv(directory))).rejects.toThrow('storage down')
  })
})
