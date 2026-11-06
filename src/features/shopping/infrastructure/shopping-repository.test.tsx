import { fakeSupabase, failure } from '@/test/fake-supabase'
import { loadShoppingData } from './shopping-repository'

describe('loadShoppingData', () => {
  it.each([
    'cook_event',
    'ingredient',
    'household_staple',
    'shopping_check',
    'shopping_override',
    'shopping_extra',
  ])('fails when %s fails, rather than deriving a list from what is left', async (table) => {
    const client = fakeSupabase(() => ({ [table]: failure }))
    expect(await loadShoppingData(client, 'p1', 'en')).toEqual({
      kind: 'err',
      error: 'query-failed',
    })
  })
})
