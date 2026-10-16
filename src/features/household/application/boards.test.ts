import { createBoard } from './boards'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

const input = {
  boardName: 'Koivisto',
  displayName: 'Aino',
  colour: '#5F7355',
  locale: 'fi',
  password: 'kaalikaari',
} as const

/** The network is the boundary: a client that answers create_board with `rows`. */
const clientAnswering = (rows: unknown[]): AppSupabaseClient =>
  ({
    auth: { getSession: () => ({ data: { session: {} } }) },
    rpc: () => ({ data: rows, error: null }),
  }) as unknown as AppSupabaseClient

describe('createBoard', () => {
  it('returns the board the server created', async () => {
    const result = await createBoard(
      clientAnswering([{ out_household_id: 'h-1', out_share_token: 'tok', out_status: 'created' }]),
      input,
    )
    expect(result).toEqual({ kind: 'ok', value: { householdId: 'h-1', shareToken: 'tok' } })
  })

  // A status and not an error: raising would roll back the record of the guess.
  it('maps a wrong beta key, returned as a status, to invalid-beta-key', async () => {
    const result = await createBoard(
      clientAnswering([
        { out_household_id: null, out_share_token: null, out_status: 'invalid-beta-key' },
      ]),
      input,
    )
    expect(result).toEqual({ kind: 'err', error: 'invalid-beta-key' })
  })
})
