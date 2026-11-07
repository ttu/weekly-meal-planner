import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const PHONE_CLOCK = '2001-01-01T00:00:00Z'

/**
 * A phone with a wrong clock must not decide when a Staple ran low or an Extra
 * was ticked: the database stamps both, whatever the client sends.
 */
describe('shopping timestamps', () => {
  let db: TestDb
  let household: string
  let ingredient: string
  let week: string

  const dbNow = async (): Promise<number> => {
    const [r] = (await db.sql('select extract(epoch from now())::float8 as t')) as { t: number }[]
    return r!.t * 1000
  }
  const ms = (iso: unknown): number => new Date(iso as string).getTime()

  beforeAll(async () => {
    db = await createTestDb()
    await db.asOwner()
    const [h] = (await db.sql('insert into household (name) values ($1) returning id', [
      'Alice household',
    ])) as { id: string }[]
    household = h!.id
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Owner', '#5F7355')`,
      [household, ALICE],
    )
    const [i] = (await db.sql(
      `insert into ingredient (household_id, slug, category, dimension, base_unit)
       values ($1, 'salt', 'spice', 'mass', 'g') returning id`,
      [household],
    )) as { id: string }[]
    ingredient = i!.id
    const [w] = (await db.sql(
      "insert into week_plan (household_id, week_start) values ($1, '2026-10-12') returning id",
      [household],
    )) as { id: string }[]
    week = w!.id
    await db.sql('insert into household_staple (household_id, ingredient_id) values ($1, $2)', [
      household,
      ingredient,
    ])
  })

  afterAll(async () => {
    await db.close()
  })

  it('stamps marked_low_at with the database clock, ignoring the client', async () => {
    await db.asMember(ALICE)
    await db.sql(
      'update household_staple set running_low = true, marked_low_at = $3 where household_id = $1 and ingredient_id = $2',
      [household, ingredient, PHONE_CLOCK],
    )
    const [row] = (await db.sql(
      'select marked_low_at from household_staple where household_id = $1',
      [household],
    )) as { marked_low_at: string }[]
    expect(Math.abs(ms(row!.marked_low_at) - (await dbNow()))).toBeLessThan(60_000)
  })

  it('stamps a ticked Extra with the database clock and clears it on untick', async () => {
    await db.asMember(ALICE)
    const [e] = (await db.sql(
      "insert into shopping_extra (week_plan_id, label) values ($1, 'Milk') returning id",
      [week],
    )) as { id: string }[]
    await db.sql('update shopping_extra set checked_at = $2 where id = $1', [e!.id, PHONE_CLOCK])
    const [ticked] = (await db.sql('select checked_at from shopping_extra where id = $1', [
      e!.id,
    ])) as { checked_at: string }[]
    expect(Math.abs(ms(ticked!.checked_at) - (await dbNow()))).toBeLessThan(60_000)

    await db.sql('update shopping_extra set checked_at = null where id = $1', [e!.id])
    const [cleared] = (await db.sql('select checked_at from shopping_extra where id = $1', [
      e!.id,
    ])) as { checked_at: string | null }[]
    expect(cleared!.checked_at).toBeNull()
  })
})
