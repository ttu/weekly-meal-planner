import { fakeSupabase, failure, rows } from '@/test/fake-supabase'
import type { WeekStart } from '../domain/types'
import { loadWeek } from './board-repository'
import { loadBacklog } from './backlog-repository'

const weekStart = '2026-03-09' as WeekStart
const planId = '0b7d7b1e-0000-4000-8000-000000000001'

describe('loadWeek', () => {
  it('says there is no Week Plan when the query succeeded and found none', async () => {
    const client = fakeSupabase(() => ({ week_plan: rows(null) }))
    expect(await loadWeek(client, weekStart)).toEqual({ kind: 'err', error: 'no-week-plan' })
  })

  // A failed query also comes back with `data: null`. Reading that as "nobody
  // has planned this week" showed an empty board for a dropped connection.
  it('does not mistake a failed query for a missing Week Plan', async () => {
    const client = fakeSupabase(() => ({ week_plan: failure }))
    expect(await loadWeek(client, weekStart)).toEqual({ kind: 'err', error: 'query-failed' })
  })

  it.each(['cook_event', 'leftover', 'household_member'])('fails when %s fails', async (table) => {
    const client = fakeSupabase(() => ({ week_plan: rows({ id: planId }), [table]: failure }))
    expect(await loadWeek(client, weekStart)).toEqual({ kind: 'err', error: 'query-failed' })
  })

  it('loads an empty but existing Week Plan', async () => {
    const client = fakeSupabase(() => ({ week_plan: rows({ id: planId }) }))
    expect(await loadWeek(client, weekStart)).toEqual({
      kind: 'ok',
      value: { weekPlanId: planId, cookEvents: [], leftovers: [] },
    })
  })
})

describe('loadBacklog', () => {
  it.each(['backlog_item', 'household_member'])('fails when %s fails', async (table) => {
    const client = fakeSupabase(() => ({ [table]: failure }))
    expect(await loadBacklog(client, planId)).toEqual({ kind: 'err', error: 'query-failed' })
  })
})
