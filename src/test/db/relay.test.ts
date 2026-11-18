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

    it('cuts off the old token for reading and writing at once', async () => {
      await create()
      await rotate()
      await expect(append(TOKEN, 1)).rejects.toThrow(/relay_forbidden/)
      await expect(pull(TOKEN)).rejects.toThrow(/relay_forbidden/)
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

  it('exposes no table to clients, so nothing can be read without a token', async () => {
    await create()
    await expect(db.sql('select * from relay_record')).rejects.toThrow()
    await expect(db.sql('select token_hash from relay_board')).rejects.toThrow()
    await expect(
      db.sql("insert into relay_record values ('x', 9, 'event', 1, 'p', 0)"),
    ).rejects.toThrow()
  })
})
