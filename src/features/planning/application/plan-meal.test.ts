import type { AppSupabaseClient, SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import { planMeal } from './plan-meal'

const input = {
  weekPlanId: 'week-plan',
  mealId: 'meal' as MealId,
  date: '2026-03-09',
  slotKey: 'dinner' as SlotKey,
  servingsCooked: 4 as Servings,
  addedBy: 'user',
}

const clientReturning = (result: { data: unknown; error: unknown }): AppSupabaseClient =>
  ({ rpc: () => Promise.resolve(result) }) as unknown as AppSupabaseClient

describe('planMeal', () => {
  it('returns the new Cook Event id', async () => {
    const result = await planMeal(clientReturning({ data: 'cook-event', error: null }), input)
    expect(result).toEqual({ kind: 'ok', value: 'cook-event' })
  })

  // The RPC returns null on purpose when the Backlog Item is already gone:
  // another Member planned it, or this is a retry after success.
  it('treats a lost race (null, no error) as success', async () => {
    const result = await planMeal(clientReturning({ data: null, error: null }), input)
    expect(result).toEqual({ kind: 'ok', value: undefined })
  })

  it('fails on an unexpected result type rather than hiding it as success', async () => {
    const result = await planMeal(clientReturning({ data: 42, error: null }), input)
    expect(result).toEqual({ kind: 'err', error: 'write-failed' })
  })

  it('fails when the RPC errors', async () => {
    const result = await planMeal(
      clientReturning({ data: null, error: { message: 'boom' } }),
      input,
    )
    expect(result).toEqual({ kind: 'err', error: 'write-failed' })
  })
})
