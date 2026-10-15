import { createTestDb, type TestDb } from './harness'

const OWNER = '11111111-1111-1111-1111-111111111111'
const JOINER = '22222222-2222-2222-2222-222222222222'
const LATECOMER = '33333333-3333-3333-3333-333333333333'

const BETA_KEY = 'kokeilu-avain'

/**
 * Until email verification exists, a beta key held in Supabase Vault closes
 * starting and joining boards to anyone who has not been given it. No key in
 * the Vault means no gate.
 */
describe('beta key', () => {
  let db: TestDb

  const createBoard = async (userId: string, betaKey?: string): Promise<unknown[]> => {
    await db.asMember(userId)
    return db.sql('select * from create_board($1, $2, $3, $4, $5, $6)', [
      'Koivisto',
      'Aino',
      '#5F7355',
      'fi',
      'kaalikaari',
      betaKey ?? null,
    ])
  }

  const join = async (userId: string, token: string, betaKey?: string): Promise<string> => {
    await db.asMember(userId)
    const [row] = (await db.sql('select * from join_board($1, $2, $3, $4)', [
      token,
      'kaalikaari',
      'Mum',
      betaKey ?? null,
    ])) as { out_status: string }[]
    return row!.out_status
  }

  const isRequired = async (): Promise<boolean> => {
    await db.asAnon()
    const [row] = (await db.sql('select beta_key_required() as required')) as {
      required: boolean
    }[]
    return row!.required
  }

  const setKey = async (key: string): Promise<void> => {
    await db.asOwner()
    await db.sql("select vault.create_secret($1, 'beta_key')", [key])
  }

  const clearKey = async (): Promise<void> => {
    await db.asOwner()
    await db.sql("delete from vault.secrets where name = 'beta_key'")
  }

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    await db.close()
  })

  // One database for the file, emptied between tests: booting one per test
  // is the slowest thing in the suite.
  beforeEach(async () => {
    await db.asOwner()
    for (const table of [
      'vault.secrets',
      'household_join_attempt',
      'household_creation_attempt',
      'household',
    ]) {
      await db.sql(`delete from ${table}`)
    }
  })

  describe('with no key in the Vault', () => {
    it('is not required', async () => {
      expect(await isRequired()).toBe(false)
    })

    it('lets a board be started without one', async () => {
      expect(await createBoard(OWNER)).toHaveLength(1)
    })

    it('lets a board be joined without one', async () => {
      const [row] = (await createBoard(OWNER)) as { out_share_token: string }[]
      expect(await join(JOINER, row!.out_share_token)).toBe('joined')
    })
  })

  describe('with a key in the Vault', () => {
    let token: string

    beforeEach(async () => {
      const [row] = (await createBoard(OWNER)) as { out_share_token: string }[]
      token = row!.out_share_token
      await setKey(BETA_KEY)
    })

    it('is required', async () => {
      expect(await isRequired()).toBe(true)
    })

    it('refuses to start a board without the key', async () => {
      await expect(createBoard(OWNER)).rejects.toThrow('Invalid beta key')
    })

    it('refuses to start a board with the wrong key', async () => {
      await expect(createBoard(OWNER, 'arvaus')).rejects.toThrow('Invalid beta key')
    })

    it('starts a board with the right key', async () => {
      expect(await createBoard(OWNER, BETA_KEY)).toHaveLength(1)
    })

    it('refuses to join without the key', async () => {
      expect(await join(JOINER, token)).toBe('invalid-beta-key')
    })

    it('refuses to join with the wrong key, even with the right link and password', async () => {
      expect(await join(JOINER, token, 'arvaus')).toBe('invalid-beta-key')
    })

    it('joins with the right key', async () => {
      expect(await join(JOINER, token, BETA_KEY)).toBe('joined')
    })

    // A wrong key is a guess like a wrong password, so it counts towards the
    // same limit rather than offering a second, unlimited door.
    it('counts a wrong key towards the join rate limit', async () => {
      for (let i = 0; i < 10; i++) await join(JOINER, token, 'arvaus')
      expect(await join(JOINER, token, BETA_KEY)).toBe('rate-limited')
    })

    it('opens again once the key is removed', async () => {
      await clearKey()
      expect(await isRequired()).toBe(false)
      expect(await join(LATECOMER, token)).toBe('joined')
    })
  })
})
