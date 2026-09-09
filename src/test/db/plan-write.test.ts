import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('plan_meal and unplan_meal', () => {
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

  const addBacklogItem = async (week: string, meal: string, by: string): Promise<string> => {
    const [b] = (await db.sql(
      'insert into backlog_item (week_plan_id, meal_id, added_by) values ($1, $2, $3) returning id',
      [week, meal, by],
    )) as { id: string }[]
    return b!.id
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

  it('creates the Cook Event and removes the Backlog Item together', async () => {
    await db.asOwner()
    const backlogId = await addBacklogItem(aliceWeek, aliceMeal, ALICE)

    await db.asMember(ALICE)
    await db.sql('select plan_meal($1, $2, $3, $4, $5, $6, $7)', [
      aliceWeek,
      aliceMeal,
      '2026-09-08',
      'dinner',
      4,
      ALICE,
      backlogId,
    ])

    expect(await db.sql('select id from backlog_item where id = $1', [backlogId])).toHaveLength(0)
    expect(
      await db.sql("select id from cook_event where date = '2026-09-08' and slot_key = 'dinner'"),
    ).toHaveLength(1)
  })

  it('carries added_by onto the Cook Event, so unplanning can restore it', async () => {
    await db.asMember(ALICE)
    const rows = (await db.sql(
      "select added_by from cook_event where date = '2026-09-08' and slot_key = 'dinner'",
    )) as { added_by: string }[]
    expect(rows[0]!.added_by).toBe(ALICE)
  })

  // The RPC is security invoker, so RLS still applies inside it.
  it("refuses to plan into another Household's Week Plan", async () => {
    await db.asMember(ALICE)
    await expect(
      db.sql('select plan_meal($1, $2, $3, $4, $5, $6, $7)', [
        bobWeek,
        aliceMeal,
        '2026-09-08',
        'dinner',
        4,
        ALICE,
        null,
      ]),
    ).rejects.toThrow()
  })

  it('plans without a Backlog Item when planning straight onto the board', async () => {
    await db.asMember(ALICE)
    await db.sql('select plan_meal($1, $2, $3, $4, $5, $6, $7)', [
      aliceWeek,
      aliceMeal,
      '2026-09-09',
      'lunch',
      2,
      ALICE,
      null,
    ])
    expect(
      await db.sql("select id from cook_event where date = '2026-09-09' and slot_key = 'lunch'"),
    ).toHaveLength(1)
  })

  it('unplanning restores the Backlog Item with its original author', async () => {
    await db.asOwner()
    const backlogId = await addBacklogItem(aliceWeek, aliceMeal, BOB)

    await db.asMember(ALICE)
    const [planned] = (await db.sql('select plan_meal($1, $2, $3, $4, $5, $6, $7) as id', [
      aliceWeek,
      aliceMeal,
      '2026-09-10',
      'dinner',
      4,
      BOB,
      backlogId,
    ])) as { id: string }[]

    await db.sql('select unplan_meal($1)', [planned!.id])

    const restored = (await db.sql(
      'select added_by from backlog_item where week_plan_id = $1 order by created_at desc limit 1',
      [aliceWeek],
    )) as { added_by: string }[]
    // BOB wanted it; unplanning must not reassign authorship to ALICE.
    expect(restored[0]!.added_by).toBe(BOB)
  })

  it('unplanning takes the Cook Event and its Leftovers with it', async () => {
    await db.asMember(ALICE)
    const [planned] = (await db.sql('select plan_meal($1, $2, $3, $4, $5, $6, $7) as id', [
      aliceWeek,
      aliceMeal,
      '2026-09-11',
      'dinner',
      6,
      ALICE,
      null,
    ])) as { id: string }[]
    await db.sql(
      "insert into leftover (cook_event_id, date, slot_key) values ($1, '2026-09-12', 'lunch')",
      [planned!.id],
    )

    await db.sql('select unplan_meal($1)', [planned!.id])

    expect(await db.sql('select id from cook_event where id = $1', [planned!.id])).toHaveLength(0)
    expect(
      await db.sql('select id from leftover where cook_event_id = $1', [planned!.id]),
    ).toHaveLength(0)
  })
})
