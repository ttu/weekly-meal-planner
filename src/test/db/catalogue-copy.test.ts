import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'

describe('copy_catalogue_meal', () => {
  let db: TestDb
  let aliceHousehold: string
  let catalogueMeal: string
  let onion: string

  beforeAll(async () => {
    db = await createTestDb()
    await db.asOwner()
    const [h] = (await db.sql(
      "insert into household (name) values ('Alice household') returning id",
    )) as { id: string }[]
    aliceHousehold = h!.id
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Aino', '#5F7355')`,
      [aliceHousehold, ALICE],
    )

    const [i] = (await db.sql(
      `insert into ingredient (household_id, slug, category, dimension, base_unit)
       values (null, 'onion', 'produce', 'count', 'pcs') returning id`,
    )) as { id: string }[]
    onion = i!.id

    const [m] = (await db.sql(
      `insert into meal (household_id, name, servings) values (null, 'Shakshuka', 2) returning id`,
    )) as { id: string }[]
    catalogueMeal = m!.id
    await db.sql(
      `insert into meal_ingredient (meal_id, ingredient_id, quantity, unit)
       values ($1, $2, 2, 'pcs')`,
      [catalogueMeal, onion],
    )
  })

  afterAll(async () => {
    await db.close()
  })

  it('copies the Meal with its Ingredients', async () => {
    await db.asMember(ALICE)
    const [copy] = (await db.sql('select copy_catalogue_meal($1, $2) as id', [
      aliceHousehold,
      catalogueMeal,
    ])) as { id: string }[]

    const rows = (await db.sql(
      'select ingredient_id, quantity, unit from meal_ingredient where meal_id = $1',
      [copy!.id],
    )) as { ingredient_id: string; unit: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.ingredient_id).toBe(onion)
  })

  it('records provenance, so a future "the original changed" prompt is possible', async () => {
    await db.asMember(ALICE)
    const [copy] = (await db.sql('select copy_catalogue_meal($1, $2) as id', [
      aliceHousehold,
      catalogueMeal,
    ])) as { id: string }[]
    const rows = (await db.sql('select copied_from_meal_id from meal where id = $1', [
      copy!.id,
    ])) as { copied_from_meal_id: string }[]
    expect(rows[0]!.copied_from_meal_id).toBe(catalogueMeal)
  })

  // ADR 0005 is only worth having if this holds.
  it('leaves the Catalogue Meal untouched when the copy is edited', async () => {
    await db.asMember(ALICE)
    const [copy] = (await db.sql('select copy_catalogue_meal($1, $2) as id', [
      aliceHousehold,
      catalogueMeal,
    ])) as { id: string }[]

    await db.sql('select save_meal($1, $2, $3, $4, $5)', [
      aliceHousehold,
      'Our shakshuka',
      6,
      '[]',
      copy!.id,
    ])

    const original = (await db.sql(
      `select m.name, m.servings, count(mi.ingredient_id) as ingredients
       from meal m left join meal_ingredient mi on mi.meal_id = m.id
       where m.id = $1 group by m.id, m.name, m.servings`,
      [catalogueMeal],
    )) as { name: string; servings: number; ingredients: number }[]

    expect(original[0]!.name).toBe('Shakshuka')
    expect(original[0]!.servings).toBe(2)
    expect(original[0]!.ingredients).toBe(1)
  })

  it('refuses to copy a Meal that is not a Catalogue Meal', async () => {
    await db.asOwner()
    const [own] = (await db.sql(
      "insert into meal (household_id, name, servings) values ($1, 'Ours', 4) returning id",
      [aliceHousehold],
    )) as { id: string }[]
    await db.asMember(ALICE)
    await expect(
      db.sql('select copy_catalogue_meal($1, $2)', [aliceHousehold, own!.id]),
    ).rejects.toThrow()
  })
})
