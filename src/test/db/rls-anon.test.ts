import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'

/**
 * A signed-out client has no auth.uid(), so app.is_member is false for every
 * Household. These tests are what make deleting the temporary demo read
 * policies verifiable rather than hopeful.
 */
describe('anonymous access', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await createTestDb()
    await db.asOwner()
    const [h] = (await db.sql(
      "insert into household (name) values ('Alice household') returning id",
    )) as { id: string }[]
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Aino', '#5F7355')`,
      [h!.id, ALICE],
    )
    await db.sql("insert into meal (household_id, name, servings) values ($1, 'Chili', 4)", [h!.id])
    await db.sql("insert into meal (household_id, name, servings) values (null, 'Shakshuka', 2)")
  })

  afterAll(async () => {
    await db.close()
  })

  it('shows no Household to a client with no identity', async () => {
    await db.asAnon()
    expect(await db.sql('select id from household')).toHaveLength(0)
  })

  it('shows no Household Meal to a client with no identity', async () => {
    await db.asAnon()
    expect(await db.sql('select id from meal where household_id is not null')).toHaveLength(0)
  })

  it('still shows Catalogue Meals, which are public by design', async () => {
    await db.asAnon()
    expect(await db.sql('select id from meal where household_id is null')).toHaveLength(1)
  })

  it('shows no Week Plan or Cook Event to a client with no identity', async () => {
    await db.asAnon()
    expect(await db.sql('select id from week_plan')).toHaveLength(0)
    expect(await db.sql('select id from cook_event')).toHaveLength(0)
  })
})
