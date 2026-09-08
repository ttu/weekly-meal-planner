import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('meal RLS', () => {
  let db: TestDb
  let aliceHousehold: string
  let bobMeal: string
  let catalogueMeal: string

  const seedHousehold = async (name: string, userId: string): Promise<string> => {
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
    aliceHousehold = await seedHousehold('Alice household', ALICE)
    const bobHousehold = await seedHousehold('Bob household', BOB)

    const [bm] = (await db.sql(
      "insert into meal (household_id, name, servings) values ($1, 'Bob chili', 4) returning id",
      [bobHousehold],
    )) as { id: string }[]
    bobMeal = bm!.id

    const [cm] = (await db.sql(
      "insert into meal (household_id, name, servings) values (null, 'Shakshuka', 2) returning id",
    )) as { id: string }[]
    catalogueMeal = cm!.id
  })

  afterAll(async () => {
    await db.close()
  })

  it("hides another Household's Meal", async () => {
    await db.asMember(ALICE)
    expect(await db.sql('select id from meal where id = $1', [bobMeal])).toHaveLength(0)
  })

  it('shows Catalogue Meals to everyone', async () => {
    await db.asMember(ALICE)
    expect(await db.sql('select id from meal where id = $1', [catalogueMeal])).toHaveLength(1)
  })

  it('refuses to let a Household edit a Catalogue Meal', async () => {
    await db.asMember(ALICE)
    await db.sql("update meal set name = 'hijacked' where id = $1", [catalogueMeal])
    const rows = (await db.sql('select name from meal where id = $1', [catalogueMeal])) as {
      name: string
    }[]
    expect(rows[0]!.name).toBe('Shakshuka')
  })

  it("refuses to let a Household delete another Household's Meal", async () => {
    await db.asMember(ALICE)
    await db.sql('delete from meal where id = $1', [bobMeal])
    await db.asMember(BOB)
    expect(await db.sql('select id from meal where id = $1', [bobMeal])).toHaveLength(1)
  })

  it('allows a Meal with no Ingredients, for the day-one quick-add path', async () => {
    await db.asMember(ALICE)
    await db.sql("insert into meal (household_id, name, servings) values ($1, 'Tacos', 4)", [
      aliceHousehold,
    ])
    const rows = (await db.sql(
      `select count(mi.ingredient_id) as ingredient_count
       from meal m left join meal_ingredient mi on mi.meal_id = m.id
       where m.name = 'Tacos' group by m.id`,
    )) as { ingredient_count: number }[]
    expect(rows[0]!.ingredient_count).toBe(0)
  })

  it('resolves one Ingredient from two Locale names', async () => {
    await db.asOwner()
    const [ing] = (await db.sql(
      `insert into ingredient (household_id, slug, category, dimension, base_unit)
       values (null, 'onion', 'produce', 'count', 'pcs') returning id`,
    )) as { id: string }[]
    await db.sql(
      `insert into ingredient_name (ingredient_id, locale, name)
       values ($1, 'fi', 'sipuli'), ($1, 'en', 'onion')`,
      [ing!.id],
    )
    await db.asMember(ALICE)
    const rows = await db.sql(
      `select n.locale from ingredient i
       join ingredient_name n on n.ingredient_id = i.id
       where i.slug = 'onion' order by n.locale`,
    )
    expect(rows).toHaveLength(2)
  })
})
