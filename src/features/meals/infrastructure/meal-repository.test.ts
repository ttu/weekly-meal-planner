import { fakeSupabase, failure, rows } from '@/test/fake-supabase'
import { loadMeals } from './meal-repository'

describe('loadMeals', () => {
  it('fails on a failed query instead of reporting an empty library', async () => {
    const client = fakeSupabase(() => ({ meal: failure }))
    expect(await loadMeals(client, 'en')).toEqual({ kind: 'err', error: 'query-failed' })
  })

  it('returns an empty library when there are genuinely no Meals', async () => {
    const client = fakeSupabase(() => ({ meal: rows([]) }))
    expect(await loadMeals(client, 'en')).toEqual({ kind: 'ok', value: [] })
  })
})
