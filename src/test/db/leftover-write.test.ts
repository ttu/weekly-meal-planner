import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('Leftover writes', () => {
  let db: TestDb
  let aliceCookEvent: string
  let bobCookEvent: string

  const seed = async (name: string, userId: string): Promise<string> => {
    await db.asOwner()
    const [h] = (await db.sql('insert into household (name) values ($1) returning id', [name])) as {
      id: string
    }[]
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Owner', '#5F7355')`,
      [h!.id, userId],
    )
    const [w] = (await db.sql(
      "insert into week_plan (household_id, week_start) values ($1, '2026-09-07') returning id",
      [h!.id],
    )) as { id: string }[]
    const [m] = (await db.sql(
      "insert into meal (household_id, name, servings) values ($1, 'Chili', 4) returning id",
      [h!.id],
    )) as { id: string }[]
    const [ce] = (await db.sql(
      `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked, added_by)
       values ($1, $2, '2026-09-07', 'dinner', 6, $3) returning id`,
      [w!.id, m!.id, userId],
    )) as { id: string }[]
    return ce!.id
  }

  beforeAll(async () => {
    db = await createTestDb()
    aliceCookEvent = await seed('Alice household', ALICE)
    bobCookEvent = await seed('Bob household', BOB)
  })

  afterAll(async () => {
    await db.close()
  })

  it('lets a Member add a Leftover to their own Cook Event', async () => {
    await db.asMember(ALICE)
    await db.sql(
      "insert into leftover (cook_event_id, date, slot_key) values ($1, '2026-09-09', 'lunch')",
      [aliceCookEvent],
    )
    expect(
      await db.sql('select id from leftover where cook_event_id = $1', [aliceCookEvent]),
    ).toHaveLength(1)
  })

  it("refuses a Leftover on another Household's Cook Event", async () => {
    await db.asMember(ALICE)
    await expect(
      db.sql(
        "insert into leftover (cook_event_id, date, slot_key) values ($1, '2026-09-09', 'lunch')",
        [bobCookEvent],
      ),
    ).rejects.toThrow()
  })

  it('allows a Leftover on the same sitting as its parent — pointless, not forbidden', async () => {
    await db.asMember(ALICE)
    await db.sql(
      "insert into leftover (cook_event_id, date, slot_key) values ($1, '2026-09-07', 'dinner')",
      [aliceCookEvent],
    )
    expect(
      await db.sql("select id from leftover where cook_event_id = $1 and date = '2026-09-07'", [
        aliceCookEvent,
      ]),
    ).toHaveLength(1)
  })

  it('removes every Leftover when the parent Cook Event goes', async () => {
    await db.asMember(ALICE)
    await db.sql('delete from cook_event where id = $1', [aliceCookEvent])
    expect(
      await db.sql('select id from leftover where cook_event_id = $1', [aliceCookEvent]),
    ).toHaveLength(0)
  })
})
