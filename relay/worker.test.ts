import worker from './worker'

const env = {} as Parameters<typeof worker.fetch>[1]
const call = (method: string, path: string) =>
  worker.fetch(new Request(`https://relay.test${path}`, { method }), env)

describe('the Worker entry', () => {
  it('answers the browser’s preflight so the app on another origin can call it', async () => {
    const reply = await call('OPTIONS', '/v1/boards/board-aaaaaaaa/append')
    expect(reply.status).toBe(204)
    expect(reply.headers.get('access-control-allow-origin')).toBe('*')
    expect(reply.headers.get('access-control-allow-headers')).toMatch(/authorization/)
  })

  it('answers anything that is not a board call with a 404 the browser may read', async () => {
    const reply = await call('POST', '/nope')
    expect(reply.status).toBe(404)
    expect(reply.headers.get('access-control-allow-origin')).toBe('*')
    expect((await call('GET', '/v1/boards/board-aaaaaaaa/pull')).status).toBe(404)
  })
})
