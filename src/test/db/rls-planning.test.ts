import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('planning RLS and cascades', () => {
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
      "insert into week_plan (household_id, week_start) values ($1, '2026-08-24') returning id",
      [h!.id],
    )) as { id: string }[]
    const [m] = (await db.sql(
      "insert into meal (household_id, name, servings) values ($1, 'Chili', 4) returning id",
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

  it('rejects a week_start that is not a Monday', async () => {
    await db.asOwner()
    await expect(
      db.sql(
        `insert into week_plan (household_id, week_start)
         select household_id, '2026-08-25' from week_plan where id = $1`,
        [aliceWeek],
      ),
    ).rejects.toThrow()
  })

  it("hides another Household's Week Plan", async () => {
    await db.asMember(ALICE)
    expect(await db.sql('select id from week_plan where id = $1', [bobWeek])).toHaveLength(0)
  })

  it("refuses a Cook Event inserted into another Household's Week Plan", async () => {
    await db.asMember(ALICE)
    await expect(
      db.sql(
        `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
         values ($1, $2, '2026-08-25', 'dinner', 4)`,
        [bobWeek, aliceMeal],
      ),
    ).rejects.toThrow()
  })

  // Two Meals on Tuesday dinner is a supported outcome, not a conflict.
  it('allows two Cook Events in the same day and Slot', async () => {
    await db.asMember(ALICE)
    for (let i = 0; i < 2; i += 1) {
      await db.sql(
        `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
         values ($1, $2, '2026-08-25', 'dinner', 4)`,
        [aliceWeek, aliceMeal],
      )
    }
    expect(
      await db.sql(
        `select id from cook_event
         where week_plan_id = $1 and date = '2026-08-25' and slot_key = 'dinner'`,
        [aliceWeek],
      ),
    ).toHaveLength(2)
  })

  it('takes Leftovers with the Cook Event when it is deleted', async () => {
    await db.asMember(ALICE)
    const [ce] = (await db.sql(
      `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
       values ($1, $2, '2026-08-26', 'dinner', 6) returning id`,
      [aliceWeek, aliceMeal],
    )) as { id: string }[]
    await db.sql(
      "insert into leftover (cook_event_id, date, slot_key) values ($1, '2026-08-27', 'lunch')",
      [ce!.id],
    )
    await db.sql('delete from cook_event where id = $1', [ce!.id])
    expect(await db.sql('select id from leftover where cook_event_id = $1', [ce!.id])).toHaveLength(
      0,
    )
  })

  it("hides another Household's Leftovers", async () => {
    await db.asOwner()
    const [ce] = (await db.sql(
      `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
       select $1, meal.id, '2026-08-25', 'lunch', 2 from meal
       where meal.household_id = (select household_id from week_plan where id = $1)
       limit 1 returning id`,
      [bobWeek],
    )) as { id: string }[]
    await db.sql(
      "insert into leftover (cook_event_id, date, slot_key) values ($1, '2026-08-26', 'lunch')",
      [ce!.id],
    )
    await db.asMember(ALICE)
    expect(await db.sql('select id from leftover where cook_event_id = $1', [ce!.id])).toHaveLength(
      0,
    )
  })
})
