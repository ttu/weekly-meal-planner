import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('Backlog writes', () => {
  let db: TestDb
  let aliceWeek: string
  let aliceMeal: string
  let bobWeek: string

  const seed = async (name: string, userId: string): Promise<{ week: string; meal: string }> => {
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
      "insert into meal (household_id, name, servings) values ($1, 'Tacos', 4) returning id",
      [h!.id],
    )) as { id: string }[]
    return { week: w!.id, meal: m!.id }
  }

  beforeAll(async () => {
    db = await createTestDb()
    const alice = await seed('Alice household', ALICE)
    const bob = await seed('Bob household', BOB)
    aliceWeek = alice.week
    aliceMeal = alice.meal
    bobWeek = bob.week
  })

  afterAll(async () => {
    await db.close()
  })

  it('lets a Member add to their own Week Plan', async () => {
    await db.asMember(ALICE)
    await db.sql('insert into backlog_item (week_plan_id, meal_id, added_by) values ($1, $2, $3)', [
      aliceWeek,
      aliceMeal,
      ALICE,
    ])
    expect(
      await db.sql('select id from backlog_item where week_plan_id = $1', [aliceWeek]),
    ).toHaveLength(1)
  })

  // The case that matters.
  it("refuses a Backlog Item in another Household's Week Plan", async () => {
    await db.asMember(ALICE)
    await expect(
      db.sql('insert into backlog_item (week_plan_id, meal_id, added_by) values ($1, $2, $3)', [
        bobWeek,
        aliceMeal,
        ALICE,
      ]),
    ).rejects.toThrow()
  })

  it("hides another Household's Backlog Items", async () => {
    await db.asOwner()
    const [m] = (await db.sql(
      `insert into meal (household_id, name, servings)
       select household_id, 'Bob curry', 4 from week_plan where id = $1 returning id`,
      [bobWeek],
    )) as { id: string }[]
    await db.sql('insert into backlog_item (week_plan_id, meal_id, added_by) values ($1, $2, $3)', [
      bobWeek,
      m!.id,
      BOB,
    ])
    await db.asMember(ALICE)
    expect(
      await db.sql('select id from backlog_item where week_plan_id = $1', [bobWeek]),
    ).toHaveLength(0)
  })

  // Wanting tacos twice is not an error.
  it('allows the same Meal in the Backlog twice', async () => {
    await db.asMember(ALICE)
    await db.sql('insert into backlog_item (week_plan_id, meal_id, added_by) values ($1, $2, $3)', [
      aliceWeek,
      aliceMeal,
      ALICE,
    ])
    const rows = await db.sql(
      'select id from backlog_item where week_plan_id = $1 and meal_id = $2',
      [aliceWeek, aliceMeal],
    )
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('lets a Member create a Week Plan for a week nobody has planned', async () => {
    await db.asMember(ALICE)
    await db.sql(
      `insert into week_plan (household_id, week_start)
       select household_id, '2026-09-14' from week_plan where id = $1`,
      [aliceWeek],
    )
    expect(await db.sql("select id from week_plan where week_start = '2026-09-14'")).toHaveLength(1)
  })
})
