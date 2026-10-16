import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

/**
 * RLS decides whose rows they are, not how many. These tests are about a
 * Member writing in a loop: each cap holds, holds per Household, and leaves
 * Catalogue rows alone.
 */
describe('write limits', () => {
  let db: TestDb
  let aliceHousehold: string
  let bobHousehold: string
  let aliceWeek: string

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
    return h!.id
  }

  // Fixture rows up to the cap, written as owner so the test is about the
  // Member's next insert, not about how fast a loop of inserts runs.
  const fillMeals = async (householdId: string, count: number): Promise<void> => {
    await db.asOwner()
    await db.sql(
      `insert into meal (household_id, name)
       select $1, 'Meal ' || n from generate_series(1, $2::integer) n`,
      [householdId, count],
    )
  }

  const insertMeal = async (householdId: string): Promise<void> => {
    await db.sql("insert into meal (household_id, name) values ($1, 'One more')", [householdId])
  }

  beforeAll(async () => {
    db = await createTestDb()
    aliceHousehold = await seed('Alice household', ALICE)
    bobHousehold = await seed('Bob household', BOB)

    await db.asOwner()
    const [w] = (await db.sql(
      "insert into week_plan (household_id, week_start) values ($1, '2026-10-12') returning id",
      [aliceHousehold],
    )) as { id: string }[]
    aliceWeek = w!.id
  })

  afterAll(async () => {
    await db.close()
  })

  it('refuses a Meal past the per-Household cap', async () => {
    await fillMeals(aliceHousehold, 500)
    await db.asMember(ALICE)
    await expect(insertMeal(aliceHousehold)).rejects.toMatchObject({ code: '54000' })
  })

  it('counts per Household, so one full board does not block another', async () => {
    await db.asMember(BOB)
    await expect(insertMeal(bobHousehold)).resolves.toBeUndefined()
  })

  it('leaves Catalogue Meals uncapped', async () => {
    await db.asOwner()
    await db.sql(
      `insert into meal (household_id, name)
       select null, 'Catalogue ' || n from generate_series(1, 501) n`,
    )
    const [row] = (await db.sql(
      'select count(*)::int as n from meal where household_id is null',
    )) as {
      n: number
    }[]
    expect(row!.n).toBe(501)
  })

  it('refuses a Backlog Item past the per-Week Plan cap', async () => {
    await db.asOwner()
    const [m] = (await db.sql(
      "insert into meal (household_id, name) values (null, 'Soup') returning id",
    )) as { id: string }[]
    await db.sql(
      `insert into backlog_item (week_plan_id, meal_id, added_by)
       select $1, $2, $3 from generate_series(1, 100)`,
      [aliceWeek, m!.id, ALICE],
    )

    await db.asMember(ALICE)
    await expect(
      db.sql('insert into backlog_item (week_plan_id, meal_id, added_by) values ($1, $2, $3)', [
        aliceWeek,
        m!.id,
        ALICE,
      ]),
    ).rejects.toMatchObject({ code: '54000' })
  })

  it('refuses an Extra past the per-Week Plan cap', async () => {
    await db.asOwner()
    await db.sql(
      `insert into shopping_extra (week_plan_id, label)
       select $1, 'Extra ' || n from generate_series(1, 100) n`,
      [aliceWeek],
    )

    await db.asMember(ALICE)
    await expect(
      db.sql("insert into shopping_extra (week_plan_id, label) values ($1, 'Milk')", [aliceWeek]),
    ).rejects.toMatchObject({ code: '54000' })
  })

  // Insert under another Week Plan, then move: without the update trigger this
  // piles any number of rows onto one.
  it('refuses moving an Extra into a full Week Plan', async () => {
    await db.asOwner()
    const [w] = (await db.sql(
      "insert into week_plan (household_id, week_start) values ($1, '2026-10-19') returning id",
      [aliceHousehold],
    )) as { id: string }[]
    // aliceWeek is already full from the test above.
    await db.asMember(ALICE)
    const [e] = (await db.sql(
      "insert into shopping_extra (week_plan_id, label) values ($1, 'Bread') returning id",
      [w!.id],
    )) as { id: string }[]
    await expect(
      db.sql('update shopping_extra set week_plan_id = $1 where id = $2', [aliceWeek, e!.id]),
    ).rejects.toMatchObject({ code: '54000' })
    await expect(
      db.sql("update shopping_extra set label = 'Rye bread' where id = $1", [e!.id]),
    ).resolves.toEqual([])
  })

  it('refuses a Member past the per-Household cap', async () => {
    await db.asOwner()
    await db.sql(
      `insert into household_member (household_id, user_id, display_name, colour)
       select $1, gen_random_uuid(), 'Member ' || n, '#5F7355' from generate_series(1, 19) n`,
      [bobHousehold],
    )
    await expect(
      db.sql(
        `insert into household_member (household_id, user_id, display_name, colour)
         values ($1, gen_random_uuid(), 'One too many', '#5F7355')`,
        [bobHousehold],
      ),
    ).rejects.toMatchObject({ code: '54000' })
  })

  it('refuses a Meal description longer than a page', async () => {
    await db.asMember(BOB)
    await expect(
      db.sql("insert into meal (household_id, name, description) values ($1, 'Long', $2)", [
        bobHousehold,
        'x'.repeat(2001),
      ]),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('refuses an Override reason longer than a sentence or two', async () => {
    await db.asOwner()
    const [i] = (await db.sql(
      `insert into ingredient (household_id, slug, category, dimension, base_unit)
       values (null, 'salt', 'pantry', 'mass', 'g') returning id`,
    )) as { id: string }[]

    await db.asMember(ALICE)
    await expect(
      db.sql(
        `insert into shopping_override (week_plan_id, ingredient_id, quantity, unit, reason)
         values ($1, $2, 1, 'g', $3)`,
        [aliceWeek, i!.id, 'x'.repeat(201)],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })
})
