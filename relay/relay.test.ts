import { handleCall, type Reply } from './api'
import { memoryDirectory } from './memory'

const BOARD = 'board-aaaaaaaa'
const TOKEN = 'a'.repeat(64)
const NEXT = 'b'.repeat(64)
const STRANGER = 'c'.repeat(64)

type Row = { seq: number; kind: string; epoch: number; payload: string; receivedAt: number }

describe('relay', () => {
  let dir: ReturnType<typeof memoryDirectory>
  let now: number

  beforeEach(() => {
    dir = memoryDirectory()
    now = 1_000_000
  })

  const call = (op: string, token: string | undefined, body: unknown, board = BOARD) =>
    handleCall(dir, { op, board, token, body }, now)
  const create = (board = BOARD, token = TOKEN) =>
    call('create', token, { payload: 'genesis' }, board)
  const append = (token = TOKEN, epoch = 1, kind = 'event', payload = 'p', board = BOARD) =>
    call('append', token, { epoch, kind, payload }, board)
  const rotate = (token = TOKEN, next = NEXT, payload = 'removal') =>
    call('rotate', token, { newToken: next, payload })
  const pullReply = (token: string | undefined = TOKEN, after: unknown = -1, board = BOARD) =>
    call('pull', token, { after }, board)
  const pull = async (token = TOKEN, after = -1, board = BOARD) =>
    ((await pullReply(token, after, board)).body as { records: Row[] }).records
  const payloads = async (token: string) => (await pull(token)).map((r) => r.payload)
  const refused = (reply: Reply, reason: string) => {
    expect(reply.body).toEqual({ error: `relay_${reason}` })
  }

  it('starts a board with its genesis record at seq 0', async () => {
    await create()
    expect((await pull())[0]).toMatchObject({
      seq: 0,
      kind: 'membership',
      epoch: 1,
      payload: 'genesis',
    })
  })

  it('refuses to start the same board twice', async () => {
    await create()
    refused(await create(), 'exists')
  })

  it('numbers records in the order it received them', async () => {
    await create()
    await append(TOKEN, 1, 'event', 'one')
    await append(TOKEN, 1, 'event', 'two')
    expect(await payloads(TOKEN)).toEqual(['genesis', 'one', 'two'])
  })

  it('stamps receipt time itself and returns it', async () => {
    await create()
    now = 2_000_000
    expect((await append()).body).toMatchObject({ seq: 1, epoch: 1, receivedAt: 2_000_000 })
    expect((await pull(TOKEN, 0))[0]?.receivedAt).toBe(2_000_000)
  })

  it('returns only records after the one asked for', async () => {
    await create()
    await append(TOKEN, 1, 'event', 'one')
    expect((await pull(TOKEN, 0)).map((r) => r.payload)).toEqual(['one'])
  })

  it('pages: a pull returns at most 500 records, and the rest follow', async () => {
    await create()
    for (let i = 0; i < 600; i++) await append(TOKEN, 1, 'event', String(i))
    const first = await pull()
    expect(first).toHaveLength(500)
    expect(await pull(TOKEN, first.at(-1)?.seq)).toHaveLength(101)
  })

  it('refuses a wrong token and an unknown board with the same answer', async () => {
    await create()
    refused(await append(STRANGER), 'forbidden')
    refused(await pullReply(STRANGER), 'forbidden')
    refused(await pullReply(TOKEN, -1, 'no-such-board'), 'forbidden')
    refused(await append(TOKEN, 1, 'event', 'p', 'no-such-board'), 'forbidden')
  })

  it('keeps boards apart: one board token reads nothing of another', async () => {
    await create()
    await create('board-bbbbbbbb', NEXT)
    refused(await pullReply(TOKEN, -1, 'board-bbbbbbbb'), 'forbidden')
  })

  it('refuses a write for any epoch but the current one', async () => {
    await create()
    refused(await append(TOKEN, 2), 'epoch')
  })

  it('refuses malformed input instead of storing it', async () => {
    await create()
    refused(await append(TOKEN, 1, 'photo'), 'bad_request')
    refused(await append(TOKEN, 1, 'event', 'x'.repeat(70_000)), 'bad_request')
    refused(await create('short', TOKEN), 'bad_request')
    refused(await create('board-cccccccc', 'not-a-token'), 'bad_request')
    refused(await call('append', TOKEN, { epoch: 1.5, kind: 'event', payload: 'p' }), 'bad_request')
    refused(await call('append', TOKEN, undefined), 'bad_request')
    refused(await call('nonsense', TOKEN, {}), 'bad_request')
    expect(await pull()).toHaveLength(1)
  })

  describe('rotating to a new epoch', () => {
    it('moves to the next epoch and records the removal in it', async () => {
      await create()
      expect((await rotate()).body).toMatchObject({ seq: 1, epoch: 2 })
      expect((await pull(NEXT)).at(-1)).toMatchObject({
        kind: 'membership',
        epoch: 2,
        payload: 'removal',
      })
    })

    it('cuts off the old token for writing at once', async () => {
      await create()
      await rotate()
      refused(await append(TOKEN, 1), 'forbidden')
      refused(await rotate(TOKEN, STRANGER), 'forbidden')
    })

    it('lets the old token read up to the rotation, so remaining Members can fetch their new key', async () => {
      await create()
      await rotate()
      expect(await payloads(TOKEN)).toEqual(['genesis', 'removal'])
    })

    it('shows the old token nothing written after the rotation', async () => {
      await create()
      await rotate()
      await append(NEXT, 2, 'event', 'secret')
      expect(await payloads(TOKEN)).toEqual(['genesis', 'removal'])
      expect(await payloads(NEXT)).toEqual(['genesis', 'removal', 'secret'])
    })

    it('does the same for a token several epochs old', async () => {
      await create()
      await rotate()
      await rotate(NEXT, STRANGER, 'second')
      expect(await payloads(TOKEN)).toEqual(['genesis', 'removal'])
      expect(await payloads(NEXT)).toEqual(['genesis', 'removal', 'second'])
    })

    it('never takes back an old token as a new one, which would undo a removal', async () => {
      await create()
      await rotate()
      refused(await rotate(NEXT, TOKEN), 'same_token')
    })

    it('accepts writes under the new token and epoch only', async () => {
      await create()
      await rotate()
      refused(await append(NEXT, 1), 'epoch')
      expect((await append(NEXT, 2)).status).toBe(200)
    })

    it('refuses a rotation by someone without the current token', async () => {
      await create()
      refused(await rotate(STRANGER), 'forbidden')
    })

    it('refuses a new token equal to the old one, which would cut nobody off', async () => {
      await create()
      refused(await rotate(TOKEN, TOKEN), 'same_token')
    })

    it('refuses a rotation built on a membership record that is no longer the last', async () => {
      await create()
      await append(TOKEN, 1, 'event', 'not membership')
      await append(TOKEN, 1, 'membership', 'an invite')
      const stale = { newToken: NEXT, payload: 'removal', afterMembership: 0 }
      refused(await call('rotate', TOKEN, stale), 'epoch')
      expect((await append(TOKEN, 1)).status).toBe(200)
      const fresh = { ...stale, afterMembership: 2 }
      expect((await call('rotate', TOKEN, fresh)).status).toBe(200)
    })

    it('caps membership records, so a Member cannot keep a rotation from ever landing', async () => {
      await create()
      for (let i = 0; i < 20; i++) expect((await append(TOKEN, 1, 'membership')).status).toBe(200)
      refused(await append(TOKEN, 1, 'membership'), 'busy')
      expect((await append(TOKEN, 1, 'event')).status).toBe(200)
      now += 60_001
      expect((await append(TOKEN, 1, 'membership')).status).toBe(200)
    })
  })

  describe('missing arguments', () => {
    it('never pass the token check, whatever the call', async () => {
      await create()
      refused(
        await call('append', undefined, { epoch: 1, kind: 'event', payload: 'p' }),
        'forbidden',
      )
      refused(await call('pull', undefined, { after: -1 }), 'forbidden')
      refused(await call('rotate', undefined, { newToken: NEXT, payload: 'x' }), 'forbidden')
    })

    it('are refused instead of stored, for every other argument too', async () => {
      await create()
      refused(await call('pull', TOKEN, {}), 'forbidden')
      refused(await call('append', TOKEN, { kind: 'event', payload: 'p' }), 'bad_request')
      refused(await call('append', TOKEN, { epoch: 1, payload: 'p' }), 'bad_request')
      refused(await call('append', TOKEN, { epoch: 1, kind: 'event' }), 'bad_request')
      refused(await call('rotate', TOKEN, { payload: 'x' }), 'bad_request')
      refused(await call('create', undefined, { payload: 'g' }, 'board-dddddddd'), 'bad_request')
      refused(await call('create', TOKEN, {}, 'board-dddddddd'), 'bad_request')
      expect(await pull()).toHaveLength(1)
    })

    it('cannot reach a stored field through a name like __proto__', async () => {
      await create()
      refused(await call('pull', TOKEN, JSON.parse('{"__proto__":{"after":-1}}')), 'forbidden')
    })
  })

  describe('abuse limits', () => {
    const setLast = async (lastSeq: number) => {
      const kv = dir.board(BOARD)
      const meta = await kv.get<{ lastSeq: number }>('meta')
      await kv.put({ meta: { ...meta, lastSeq } })
    }

    it('stops a board growing without bound', async () => {
      await create()
      await setLast(100_000)
      refused(await append(), 'full')
    })

    it('keeps a little headroom so a full board can still cut a Member off, but not forever', async () => {
      await create()
      await setLast(100_050)
      expect((await rotate()).status).toBe(200)
      await setLast(100_100)
      refused(await rotate(NEXT, TOKEN), 'full')
    })

    it('does not count refused creations against the quota', async () => {
      await create()
      for (let i = 0; i < 1100; i++) await create()
      refused(await create('short'), 'bad_request')
      expect((await create('board-eeeeeeee')).status).toBe(200)
    })

    it('stops board creation being used to fill the relay, and recovers after an hour', async () => {
      for (let i = 0; i < 1000; i++) await create(`flood-board-${String(i)}`)
      refused(await create(), 'busy')
      now += 3_600_001
      expect((await create()).status).toBe(200)
    })
  })
})
