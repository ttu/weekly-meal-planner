import { createTestDb, type TestDb } from './harness'

const OWNER = '11111111-1111-1111-1111-111111111111'
const JOINER = '22222222-2222-2222-2222-222222222222'
const STRANGER = '33333333-3333-3333-3333-333333333333'

/**
 * The link is a bearer credential and the password is the second factor
 * (ADR 0010). These tests are about what a person holding one, the other, or
 * neither can reach.
 */
describe('board sharing', () => {
  let db: TestDb
  let token: string
  let householdId: string

  const createBoard = async (
    userId: string,
    password: string,
  ): Promise<{ id: string; token: string }> => {
    await db.asMember(userId)
    const [row] = (await db.sql('select * from create_board($1, $2, $3, $4, $5)', [
      'Koivisto',
      'Aino',
      '#5F7355',
      'fi',
      password,
    ])) as { out_household_id: string; out_share_token: string }[]
    return { id: row!.out_household_id, token: row!.out_share_token }
  }

  beforeAll(async () => {
    db = await createTestDb()
    const board = await createBoard(OWNER, 'kaalikaari')
    householdId = board.id
    token = board.token
  })

  afterAll(async () => {
    await db.close()
  })

  it('gives the creator a board they can see', async () => {
    await db.asMember(OWNER)
    const rows = (await db.sql('select name from household where id = $1', [householdId])) as {
      name: string
    }[]
    expect(rows[0]!.name).toBe('Koivisto')
  })

  it('mints a token long enough not to be guessed', () => {
    expect(token.length).toBeGreaterThanOrEqual(40)
  })

  it('mints a URL-safe token', () => {
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('never stores the board password in plaintext', async () => {
    await db.asOwner()
    const rows = (await db.sql('select join_password_hash from household where id = $1', [
      householdId,
    ])) as { join_password_hash: string }[]
    expect(rows[0]!.join_password_hash).not.toContain('kaalikaari')
    expect(rows[0]!.join_password_hash.startsWith('$2')).toBe(true)
  })

  // Before joining, a stranger is exactly as blind as anyone else.
  it('shows nothing to someone who has not joined', async () => {
    await db.asMember(STRANGER)
    expect(await db.sql('select id from household')).toHaveLength(0)
  })

  const join = async (t: string, password: string): Promise<string> => {
    const [row] = (await db.sql('select * from join_board($1, $2)', [t, password])) as {
      out_status: string
    }[]
    return row!.out_status
  }

  it('lets a person with the link and the password join', async () => {
    await db.asMember(JOINER)
    expect(await join(token, 'kaalikaari')).toBe('joined')
    const rows = (await db.sql('select name from household')) as { name: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('Koivisto')
  })

  // The whole point of the password: a leaked link is not a leaked board.
  it('refuses the link with the wrong password', async () => {
    await db.asMember(STRANGER)
    expect(await join(token, 'wrong')).toBe('rejected')
    expect(await db.sql('select id from household')).toHaveLength(0)
  })

  it('refuses a made-up link', async () => {
    await db.asMember(STRANGER)
    expect(await join('not-a-real-token', 'kaalikaari')).toBe('rejected')
  })

  // Distinguishable errors would make this a token oracle.
  it('gives the same answer for a bad token and a bad password', async () => {
    await db.asMember(STRANGER)
    expect(await join('nope', 'kaalikaari')).toBe(await join(token, 'nope'))
  })

  it('stops brute force against the password', async () => {
    await db.asOwner()
    const other = await createBoard(OWNER, 'salasana')
    await db.asMember(STRANGER)

    for (let i = 0; i < 10; i += 1) {
      expect(await join(other.token, `guess-${String(i)}`)).toBe('rejected')
    }

    // Even the right password is refused once the limit is hit.
    expect(await join(other.token, 'salasana')).toBe('rate-limited')
  })

  it('clears the attempt count on a successful join', async () => {
    await db.asOwner()
    const other = await createBoard(OWNER, 'oikeasana')
    await db.asMember(STRANGER)

    expect(await join(other.token, 'väärä')).toBe('rejected')
    expect(await join(other.token, 'oikeasana')).toBe('joined')

    const rows = await db.sql(
      'select share_token from household_join_attempt where share_token = $1',
      [other.token],
    )
    expect(rows).toHaveLength(0)
  })

  it('refuses to create a board with a trivially short password', async () => {
    await db.asMember(OWNER)
    await expect(
      db.sql('select * from create_board($1, $2, $3, $4, $5)', ['X', 'A', '#000000', 'fi', 'abc']),
    ).rejects.toThrow()
  })
})
