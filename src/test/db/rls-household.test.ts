import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

/**
 * These assert that a Member *cannot* reach another Household. A test proving a
 * Member reads their own data proves nothing: RLS is the sole authorization
 * point (ADR 0002), so its tests must be adversarial.
 */
describe('household RLS', () => {
  let db: TestDb
  let aliceHousehold: string
  let bobHousehold: string

  const seed = async (name: string, userId: string): Promise<string> => {
    // Fixtures are created as the table owner; policies do not apply to it.
    await db.asOwner()
    const [row] = (await db.sql('insert into household (name) values ($1) returning id', [
      name,
    ])) as { id: string }[]
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Owner', '#5F7355')`,
      [row!.id, userId],
    )
    return row!.id
  }

  beforeAll(async () => {
    db = await createTestDb()
    // Seeded as the table owner, before any set role — policies do not apply to
    // the owner, which is how the fixtures get created at all.
    aliceHousehold = await seed('Alice household', ALICE)
    bobHousehold = await seed('Bob household', BOB)
  })

  afterAll(async () => {
    await db.close()
  })

  it('lets a Member read their own Household', async () => {
    await db.asMember(ALICE)
    const rows = (await db.sql('select id from household')) as { id: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(aliceHousehold)
  })

  it('hides another Household entirely', async () => {
    await db.asMember(ALICE)
    expect(await db.sql('select id from household where id = $1', [bobHousehold])).toHaveLength(0)
  })

  it('refuses to update another Household', async () => {
    await db.asMember(ALICE)
    await db.sql("update household set name = 'stolen' where id = $1", [bobHousehold])
    await db.asMember(BOB)
    const rows = (await db.sql('select name from household where id = $1', [bobHousehold])) as {
      name: string
    }[]
    expect(rows[0]!.name).toBe('Bob household')
  })

  // Slots are edited from Settings as a plain update to the household row, so
  // the policy that allows it is the only thing standing between one family's
  // board and another's.
  it("refuses to rewrite another Household's Slots", async () => {
    await db.asMember(ALICE)
    await db.sql(`update household set slots = '[{"key":"brunch","labelKey":"x"}]'::jsonb`)
    await db.asMember(BOB)
    const rows = (await db.sql('select slots from household where id = $1', [bobHousehold])) as {
      slots: { key: string }[]
    }[]
    expect(rows[0]!.slots.map((slot) => slot.key)).toEqual(['lunch', 'dinner'])
  })

  it("hides another Household's Members", async () => {
    await db.asMember(ALICE)
    expect(
      await db.sql('select user_id from household_member where household_id = $1', [bobHousehold]),
    ).toHaveLength(0)
  })

  it('leaves a Household unreachable once membership is removed', async () => {
    const temp = await seed('Temp household', ALICE)
    await db.sql('delete from household_member where household_id = $1', [temp])
    await db.asMember(ALICE)
    expect(await db.sql('select id from household where id = $1', [temp])).toHaveLength(0)
  })
})
