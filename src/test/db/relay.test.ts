import { createTestDb, type TestDb } from './harness'

const BOARD = 'board-aaaaaaaa'
const TOKEN = 'a'.repeat(64)
const NEXT = 'b'.repeat(64)
const STRANGER = 'c'.repeat(64)

type Stamp = { seq: number; received_at: number }
type Row = { seq: number; kind: string; epoch: number; payload: string; received_at: number }

describe('relay', () => {
  let db: TestDb

  beforeEach(async () => {
    db = await createTestDb()
    await db.asAnon()
  })

  afterEach(async () => {
    await db.close()
  })

  const create = (board = BOARD, token = TOKEN) =>
    db.sql('select * from relay_create($1, $2, $3)', [board, token, 'genesis'])
  const append = (token = TOKEN, epoch = 1, kind = 'event', payload = 'p', board = BOARD) =>
    db.sql('select * from relay_append($1, $2, $3, $4, $5)', [board, token, epoch, kind, payload])
  const pull = (token = TOKEN, after = -1, board = BOARD) =>
    db.sql('select * from relay_pull($1, $2, $3, 500)', [board, token, after]) as Promise<Row[]>

  it('starts a board with its genesis record at seq 0', async () => {
    await create()
    const rows = await pull()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ seq: 0, kind: 'membership', epoch: 1, payload: 'genesis' })
  })

  it('refuses to start the same board twice', async () => {
    await create()
    await expect(create()).rejects.toThrow(/relay_exists/)
  })

  it('numbers records in the order it received them', async () => {
    await create()
    await append(TOKEN, 1, 'event', 'one')
    await append(TOKEN, 1, 'event', 'two')
    expect((await pull()).map((r) => r.payload)).toEqual(['genesis', 'one', 'two'])
  })

  it('stamps receipt time itself and returns it', async () => {
    await create()
    const [stamp] = (await append()) as Stamp[]
    expect(Math.abs(Number(stamp?.received_at) - Date.now())).toBeLessThan(60_000)
  })

  it('returns only records after the one asked for', async () => {
    await create()
    await append(TOKEN, 1, 'event', 'one')
    expect((await pull(TOKEN, 0)).map((r) => r.payload)).toEqual(['one'])
  })

  it('refuses a wrong token and an unknown board with the same answer', async () => {
    await create()
    await expect(append(STRANGER)).rejects.toThrow(/relay_forbidden/)
    await expect(pull(STRANGER)).rejects.toThrow(/relay_forbidden/)
    await expect(pull(TOKEN, -1, 'no-such-board')).rejects.toThrow(/relay_forbidden/)
  })

  it('keeps boards apart: one board token reads nothing of another', async () => {
    await create()
    await create('board-bbbbbbbb', NEXT)
    await expect(pull(TOKEN, -1, 'board-bbbbbbbb')).rejects.toThrow(/relay_forbidden/)
  })

  it('refuses a write for any epoch but the current one', async () => {
    await create()
    await expect(append(TOKEN, 2)).rejects.toThrow(/relay_epoch/)
  })

  it('refuses malformed input instead of storing it', async () => {
    await create()
    await expect(append(TOKEN, 1, 'photo')).rejects.toThrow()
    await expect(append(TOKEN, 1, 'event', 'x'.repeat(70_000))).rejects.toThrow()
    await expect(create('short', TOKEN)).rejects.toThrow()
    await expect(create('board-cccccccc', 'not-a-token')).rejects.toThrow()
  })

  describe('rotating to a new epoch', () => {
    const rotate = (token = TOKEN, next = NEXT) =>
      db.sql('select * from relay_rotate($1, $2, $3, $4)', [BOARD, token, next, 'removal'])

    it('moves to the next epoch and records the removal in it', async () => {
      await create()
      await rotate()
      const rows = await pull(NEXT)
      expect(rows.at(-1)).toMatchObject({ kind: 'membership', epoch: 2, payload: 'removal' })
    })

    it('cuts off the old token for writing at once', async () => {
      await create()
      await rotate()
      await expect(append(TOKEN, 1)).rejects.toThrow(/relay_forbidden/)
      await expect(rotate(TOKEN, STRANGER)).rejects.toThrow(/relay_forbidden/)
    })

    it('lets the old token read up to the rotation, so remaining Members can fetch their new key', async () => {
      await create()
      await rotate()
      expect((await pull(TOKEN)).map((r) => r.payload)).toEqual(['genesis', 'removal'])
    })

    it('shows the old token nothing written after the rotation', async () => {
      await create()
      await rotate()
      await append(NEXT, 2, 'event', 'secret')
      expect((await pull(TOKEN)).map((r) => r.payload)).toEqual(['genesis', 'removal'])
      expect((await pull(NEXT)).map((r) => r.payload)).toEqual(['genesis', 'removal', 'secret'])
    })

    it('does the same for a token several epochs old', async () => {
      await create()
      await rotate()
      await db.sql('select * from relay_rotate($1, $2, $3, $4)', [BOARD, NEXT, STRANGER, 'second'])
      expect((await pull(TOKEN)).map((r) => r.payload)).toEqual(['genesis', 'removal'])
      expect((await pull(NEXT)).map((r) => r.payload)).toEqual(['genesis', 'removal', 'second'])
    })

    it('never takes back an old token as a new one, which would undo a removal', async () => {
      await create()
      await rotate()
      await expect(rotate(NEXT, TOKEN)).rejects.toThrow(/relay_same_token/)
    })

    it('accepts writes under the new token and epoch only', async () => {
      await create()
      await rotate()
      await expect(append(NEXT, 1)).rejects.toThrow(/relay_epoch/)
      await expect(append(NEXT, 2)).resolves.toBeDefined()
    })

    it('refuses a rotation by someone without the current token', async () => {
      await create()
      await expect(rotate(STRANGER)).rejects.toThrow(/relay_forbidden/)
    })

    it('refuses a new token equal to the old one, which would cut nobody off', async () => {
      await create()
      await expect(rotate(TOKEN, TOKEN)).rejects.toThrow(/relay_same_token/)
    })
  })

  describe('NULL arguments', () => {
    const nulls = (query: string, params: unknown[]) => db.sql(query, params)

    it('never pass the token check, whatever the function', async () => {
      await create()
      await expect(
        nulls('select * from relay_append($1, null, 1, $2, $3)', [BOARD, 'event', 'p']),
      ).rejects.toThrow(/relay_forbidden/)
      await expect(nulls('select * from relay_pull($1, null, -1, 500)', [BOARD])).rejects.toThrow(
        /relay_forbidden/,
      )
      await expect(
        nulls('select * from relay_rotate($1, null, $2, $3)', [BOARD, NEXT, 'x']),
      ).rejects.toThrow(/relay_forbidden/)
    })

    it('are refused instead of stored, for every other argument too', async () => {
      await create()
      await expect(
        nulls('select * from relay_append($1, $2, null, $3, $4)', [BOARD, TOKEN, 'event', 'p']),
      ).rejects.toThrow()
      await expect(
        nulls('select * from relay_append($1, $2, 1, null, $3)', [BOARD, TOKEN, 'p']),
      ).rejects.toThrow()
      await expect(
        nulls('select * from relay_append($1, $2, 1, $3, null)', [BOARD, TOKEN, 'event']),
      ).rejects.toThrow()
      await expect(
        nulls('select * from relay_rotate($1, $2, null, $3)', [BOARD, TOKEN, 'x']),
      ).rejects.toThrow()
      await expect(
        nulls('select * from relay_create(null, $1, $2)', [TOKEN, 'g']),
      ).rejects.toThrow()
      await expect(
        nulls('select * from relay_create($1, null, $2)', ['board-dddddddd', 'g']),
      ).rejects.toThrow()
      expect(await pull()).toHaveLength(1)
    })
  })

  describe('abuse limits', () => {
    it('stops a board growing without bound', async () => {
      await create()
      await db.asOwner()
      await db.sql('update relay_board set last_seq = 100000 where id = $1', [BOARD])
      await db.asAnon()
      await expect(append()).rejects.toThrow(/relay_full/)
    })

    it('keeps a little headroom so a full board can still cut a Member off, but not forever', async () => {
      await create()
      await db.asOwner()
      await db.sql('update relay_board set last_seq = 100050 where id = $1', [BOARD])
      await db.asAnon()
      await expect(
        db.sql('select * from relay_rotate($1, $2, $3, $4)', [BOARD, TOKEN, NEXT, 'x']),
      ).resolves.toBeDefined()
      await db.asOwner()
      await db.sql('update relay_board set last_seq = 100100 where id = $1', [BOARD])
      await db.asAnon()
      await expect(
        db.sql('select * from relay_rotate($1, $2, $3, $4)', [BOARD, NEXT, TOKEN, 'x']),
      ).rejects.toThrow(/relay_full/)
    })

    it('stops board creation being used to fill the table', async () => {
      await db.asOwner()
      await db.sql(
        `insert into relay_board (id, token_hash, last_seq)
         select 'flood-board-' || g, '\\x00', 0 from generate_series(1, 1000) g`,
      )
      await db.asAnon()
      await expect(create()).rejects.toThrow(/relay_busy/)
    })
  })

  it('exposes no table to clients, so nothing can be read without a token', async () => {
    await create()
    await expect(db.sql('select * from relay_record')).rejects.toThrow()
    await expect(db.sql('select token_hash from relay_board')).rejects.toThrow()
    await expect(
      db.sql("insert into relay_record values ('x', 9, 'event', 1, 'p', 0)"),
    ).rejects.toThrow()
  })
})
