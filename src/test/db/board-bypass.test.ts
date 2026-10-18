import { createTestDb, type TestDb } from './harness'

const OWNER = '11111111-1111-1111-1111-111111111111'
const OUTSIDER = '22222222-2222-2222-2222-222222222222'

/**
 * create_board is the only door into a Household (ADR 0010): it checks the beta
 * key, the creation limits and hashes the board password. These tests knock on
 * every other door.
 */
describe('board creation bypass', () => {
  let db: TestDb
  let householdId: string
  let token: string

  beforeAll(async () => {
    db = await createTestDb()
    await db.asMember(OWNER)
    const [row] = (await db.sql('select * from create_board($1, $2, $3, $4, $5)', [
      'Koivisto',
      'Aino',
      '#5F7355',
      'fi',
      'kaalikaari',
    ])) as { out_household_id: string; out_share_token: string }[]
    householdId = row!.out_household_id
    token = row!.out_share_token
  })

  afterAll(async () => {
    await db.close()
  })

  it('refuses a household written straight to the table', async () => {
    await db.asMember(OUTSIDER)
    await expect(
      db.sql('insert into household (id, name) values (gen_random_uuid(), $1)', ['Sneaked in']),
    ).rejects.toThrow(/row-level security/)
  })

  it('refuses a membership written straight to the table, even for a Member', async () => {
    await db.asMember(OWNER)
    await expect(
      db.sql(
        `insert into household_member (household_id, user_id, role, display_name, colour)
         values ($1, $2, 'owner', 'Guest', '#5F7355')`,
        [householdId, OUTSIDER],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('refuses a membership in a Household nobody belongs to', async () => {
    await db.asOwner()
    const [empty] = (await db.sql(
      "insert into household (name) values ('Abandoned') returning id",
    )) as { id: string }[]
    await db.asMember(OUTSIDER)
    await expect(
      db.sql(
        `insert into household_member (household_id, user_id, role, display_name, colour)
         values ($1, $2, 'owner', 'Squatter', '#5F7355')`,
        [empty!.id, OUTSIDER],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('lets a Member change the slots and the locale', async () => {
    await db.asMember(OWNER)
    await db.sql("update household set locale = 'en' where id = $1", [householdId])
    await db.sql(`update household set slots = '[{"key":"x","labelKey":"x"}]'::jsonb`)
    const [row] = (await db.sql('select locale from household where id = $1', [householdId])) as {
      locale: string
    }[]
    expect(row!.locale).toBe('en')
  })

  it('refuses a Member rotating the share token', async () => {
    await db.asMember(OWNER)
    await expect(
      db.sql("update household set share_token = 'mine' where id = $1", [householdId]),
    ).rejects.toThrow(/permission denied/)
  })

  it('refuses a Member overwriting the board password hash', async () => {
    await db.asMember(OWNER)
    await expect(
      db.sql("update household set join_password_hash = 'x' where id = $1", [householdId]),
    ).rejects.toThrow(/permission denied/)
    await db.asOwner()
    const [row] = (await db.sql('select share_token from household where id = $1', [
      householdId,
    ])) as { share_token: string }[]
    expect(row!.share_token).toBe(token)
  })

  it('does not record a guess at a token too long to be one', async () => {
    await db.asMember(OUTSIDER)
    const [row] = (await db.sql('select * from join_board($1, $2)', ['x'.repeat(5000), 'pw'])) as {
      out_status: string
    }[]
    expect(row!.out_status).toBe('rejected')
    await db.asOwner()
    expect(
      await db.sql('select 1 from household_join_attempt where length(share_token) > 100'),
    ).toHaveLength(0)
  })

  it('forgets attempts older than a day when the next one arrives', async () => {
    await db.asOwner()
    await db.sql(
      `insert into household_join_attempt (share_token, attempted_at)
       values ('stale', now() - interval '2 days')`,
    )
    await db.asMember(OUTSIDER)
    await db.sql('select * from join_board($1, $2)', [token, 'wrong-password'])
    await db.asOwner()
    expect(
      await db.sql("select 1 from household_join_attempt where share_token = 'stale'"),
    ).toHaveLength(0)
    expect(
      await db.sql('select 1 from household_join_attempt where share_token = $1', [token]),
    ).toHaveLength(1)
  })
})
