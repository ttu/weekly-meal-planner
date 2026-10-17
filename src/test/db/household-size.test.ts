import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'

describe('household size', () => {
  let db: TestDb
  let household: string

  beforeAll(async () => {
    db = await createTestDb()
    await db.asOwner()
    const [h] = (await db.sql("insert into household (name) values ('Alice') returning id")) as {
      id: string
    }[]
    household = h!.id
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Owner', '#5F7355')`,
      [household, ALICE],
    )
  })

  afterAll(async () => {
    await db.close()
  })

  const sizeOf = async (): Promise<number> => {
    const rows = (await db.sql('select size from household where id = $1', [household])) as {
      size: number
    }[]
    return rows[0]!.size
  }

  it('starts at four', async () => {
    await db.asMember(ALICE)
    expect(await sizeOf()).toBe(4)
  })

  it('lets a Member change it', async () => {
    await db.asMember(ALICE)
    await db.sql('update household set size = 2 where id = $1', [household])
    expect(await sizeOf()).toBe(2)
  })

  it("refuses to change another Household's size", async () => {
    await db.asOwner()
    const [other] = (await db.sql("insert into household (name) values ('Bob') returning id")) as {
      id: string
    }[]
    await db.asMember(ALICE)
    await db.sql('update household set size = 9 where id = $1', [other!.id])
    await db.asOwner()
    const rows = (await db.sql('select size from household where id = $1', [other!.id])) as {
      size: number
    }[]
    expect(rows[0]!.size).toBe(4)
  })

  it.each([0, 51])('refuses %i, which no Meal could be started at', async (size) => {
    await db.asMember(ALICE)
    await expect(
      db.sql('update household set size = $2 where id = $1', [household, size]),
    ).rejects.toMatchObject({ code: '23514' })
  })
})
