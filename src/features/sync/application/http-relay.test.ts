import { httpRelay, type Fetch } from './http-relay'

describe('the relay over HTTP', () => {
  it('gives up on a call that hangs, as offline, so the writes queued behind it can go on', async () => {
    const hangs: Fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new Error('aborted'))
        })
      })
    const relay = httpRelay('http://relay.test', hangs, 10)
    expect(await relay.pull('board-aaaaaaaa', 'a'.repeat(64), -1)).toEqual({
      kind: 'err',
      error: 'offline',
    })
  })
})
