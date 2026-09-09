import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('Meal writes', () => {
  let db: TestDb
  let aliceHousehold: string
  let bobHousehold: string
  let bobMeal: string
  let onion: string
  let beef: string

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

  beforeAll(async () => {
    db = await createTestDb()
    aliceHousehold = await seed('Alice household', ALICE)
    bobHousehold = await seed('Bob household', BOB)

    const ingredient = async (slug: string): Promise<string> => {
      const [i] = (await db.sql(
        `insert into ingredient (household_id, slug, category, dimension, base_unit)
         values (null, $1, 'produce', 'mass', 'g') returning id`,
        [slug],
      )) as { id: string }[]
      return i!.id
    }
    onion = await ingredient('onion')
    beef = await ingredient('minced-beef')

    const [bm] = (await db.sql(
      "insert into meal (household_id, name, servings) values ($1, 'Bob chili', 4) returning id",
      [bobHousehold],
    )) as { id: string }[]
    bobMeal = bm!.id
  })

  afterAll(async () => {
    await db.close()
  })

  it('saves a Meal with no Ingredients — the day-one path', async () => {
    await db.asMember(ALICE)
    const [row] = (await db.sql('select save_meal($1, $2, $3, $4) as id', [
      aliceHousehold,
      'Pizza',
      4,
      '[]',
    ])) as { id: string }[]
    const counts = (await db.sql('select count(*) as n from meal_ingredient where meal_id = $1', [
      row!.id,
    ])) as { n: number }[]
    expect(counts[0]!.n).toBe(0)
  })

  it('saves a Meal with Ingredients', async () => {
    await db.asMember(ALICE)
    const [row] = (await db.sql('select save_meal($1, $2, $3, $4) as id', [
      aliceHousehold,
      'Chili',
      4,
      JSON.stringify([
        { ingredientId: onion, quantity: 2, unit: 'pcs', optional: false },
        { ingredientId: beef, quantity: 400, unit: 'g', optional: false },
      ]),
    ])) as { id: string }[]
    expect(
      await db.sql('select ingredient_id from meal_ingredient where meal_id = $1', [row!.id]),
    ).toHaveLength(2)
  })

  // The editor sends the whole list; accumulating would double Ingredients on
  // every save and quietly double the Shopping List.
  it('replaces Ingredient rows on re-save rather than accumulating', async () => {
    await db.asMember(ALICE)
    const [row] = (await db.sql('select save_meal($1, $2, $3, $4) as id', [
      aliceHousehold,
      'Stew',
      4,
      JSON.stringify([{ ingredientId: onion, quantity: 2, unit: 'pcs', optional: false }]),
    ])) as { id: string }[]

    await db.sql('select save_meal($1, $2, $3, $4, $5)', [
      aliceHousehold,
      'Stew',
      4,
      JSON.stringify([{ ingredientId: beef, quantity: 300, unit: 'g', optional: false }]),
      row!.id,
    ])

    const rows = (await db.sql('select ingredient_id from meal_ingredient where meal_id = $1', [
      row!.id,
    ])) as { ingredient_id: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.ingredient_id).toBe(beef)
  })

  it('refuses to save into another Household', async () => {
    await db.asMember(ALICE)
    await expect(
      db.sql('select save_meal($1, $2, $3, $4)', [bobHousehold, 'Sneaky', 4, '[]']),
    ).rejects.toThrow()
  })

  it("refuses to edit another Household's Meal", async () => {
    await db.asMember(ALICE)
    await expect(
      db.sql('select save_meal($1, $2, $3, $4, $5)', [
        aliceHousehold,
        'Hijacked',
        4,
        '[]',
        bobMeal,
      ]),
    ).rejects.toThrow()
  })
})
