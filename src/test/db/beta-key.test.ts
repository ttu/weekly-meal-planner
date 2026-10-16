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

  type CreatedRow = { out_share_token: string | null; out_status: string }

  const createBoard = async (userId: string, betaKey?: string): Promise<CreatedRow[]> => {
    await db.asMember(userId)
    return (await db.sql('select * from create_board($1, $2, $3, $4, $5, $6)', [
      'Koivisto',
      'Aino',
      '#5F7355',
      'fi',
      'kaalikaari',
      betaKey ?? null,
    ])) as CreatedRow[]
  }

  const createStatus = async (userId: string, betaKey?: string): Promise<string> =>
    (await createBoard(userId, betaKey))[0]!.out_status

  const fromIp = async (ip: string): Promise<void> => {
    await db.sql("select set_config('request.headers', $1, false)", [
      JSON.stringify({ 'x-forwarded-for': ip }),
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
    await db.sql("select set_config('request.headers', '', false)")
    for (const table of [
      'vault.secrets',
      'household_join_attempt',
      'household_creation_attempt',
      'beta_key_attempt',
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
      expect(await createStatus(OWNER)).toBe('created')
    })

    it('lets a board be joined without one', async () => {
      const [row] = await createBoard(OWNER)
      expect(await join(JOINER, row!.out_share_token!)).toBe('joined')
    })
  })

  describe('with a key in the Vault', () => {
    let token: string

    beforeEach(async () => {
      const [row] = await createBoard(OWNER)
      token = row!.out_share_token!
      await setKey(BETA_KEY)
    })

    it('is required', async () => {
      expect(await isRequired()).toBe(true)
    })

    it('refuses to start a board without the key', async () => {
      expect(await createStatus(OWNER)).toBe('invalid-beta-key')
    })

    it('refuses to start a board with the wrong key', async () => {
      const [row] = await createBoard(OWNER, 'arvaus')
      expect(row).toMatchObject({ out_status: 'invalid-beta-key', out_share_token: null })
    })

    it('starts a board with the right key', async () => {
      expect(await createStatus(OWNER, BETA_KEY)).toBe('created')
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

    // Typed on a phone that capitalises the first letter, or pasted from a
    // message with a space on the end: still the right key.
    it('ignores case and surrounding spaces in the key given', async () => {
      expect(await join(JOINER, token, `  ${BETA_KEY.toUpperCase()} `)).toBe('joined')
      expect(await createStatus(OWNER, ' Kokeilu-Avain\n')).toBe('created')
    })

    it('ignores case and surrounding spaces in the key set', async () => {
      await clearKey()
      await setKey(' Kokeilu-Avain ')
      expect(await join(JOINER, token, BETA_KEY)).toBe('joined')
    })

    it('still refuses a key that differs inside', async () => {
      expect(await join(JOINER, token, 'kokeilu avain')).toBe('invalid-beta-key')
    })

    // A wrong key is a guess, and it must be counted against whoever is
    // guessing. Counted against the link instead, a guesser changes the link
    // on every try and is never limited.
    describe('guessing the key', () => {
      const guess = async (userId: string, times: number, tokenToTry = token): Promise<void> => {
        for (let i = 0; i < times; i++) await join(userId, tokenToTry, 'arvaus')
      }

      it('limits one account, and then refuses even the right key', async () => {
        await guess(JOINER, 10)
        expect(await join(JOINER, token, BETA_KEY)).toBe('rate-limited')
      })

      it('is not got round by changing the link on every try', async () => {
        for (let i = 0; i < 10; i++) await join(JOINER, `not-a-link-${String(i)}`, 'arvaus')
        expect(await join(JOINER, token, BETA_KEY)).toBe('rate-limited')
      })

      it('counts a failed attempt to start a board, which raises nothing to roll it back', async () => {
        for (let i = 0; i < 10; i++) await createBoard(JOINER, 'arvaus')
        await expect(createBoard(JOINER, BETA_KEY)).rejects.toThrow('Too many attempts')
      })

      it('counts both doors against the same limit', async () => {
        await guess(JOINER, 5)
        for (let i = 0; i < 5; i++) await createBoard(JOINER, 'arvaus')
        expect(await join(JOINER, token, BETA_KEY)).toBe('rate-limited')
      })

      it('limits an address across accounts', async () => {
        await db.asOwner()
        await fromIp('203.0.113.7')
        for (let i = 0; i < 30; i++) {
          const account = `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
          await db.asMember(account)
          await fromIp('203.0.113.7')
          await join(account, token, 'arvaus')
        }
        const fresh = '99999999-9999-9999-9999-999999999999'
        await db.asMember(fresh)
        await fromIp('203.0.113.7')
        expect(await join(fresh, token, BETA_KEY)).toBe('rate-limited')
      })

      it('leaves other people and addresses alone', async () => {
        await guess(JOINER, 10)
        expect(await join(LATECOMER, token, BETA_KEY)).toBe('joined')
      })

      // Otherwise anyone holding no key at all could lock a family's own link
      // by guessing at it.
      it('does not spend the link’s own attempts on the board password', async () => {
        await guess(JOINER, 10)
        await db.asOwner()
        const rows = await db.sql('select count(*)::int as n from household_join_attempt')
        expect(rows).toEqual([{ n: 0 }])
      })
    })

    it('opens again once the key is removed', async () => {
      await clearKey()
      expect(await isRequired()).toBe(false)
      expect(await join(LATECOMER, token)).toBe('joined')
    })
  })
})
