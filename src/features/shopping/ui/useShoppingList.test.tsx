import { act, renderHook, waitFor } from '@testing-library/react-native'
import { randomBytes } from '@noble/hashes/utils'
import { boardWrapper, testClock } from '@/test/session-wrapper'
import { testBoard } from '@/test/test-board'
import { brand } from '@/shared/types/brand'
import type { IngredientId } from '@/shared/types/ids'
import type { SlotKey } from '@/features/household'

import { saveMeal } from '@/features/meals'
import { planMeal } from '@/features/planning'
import { useShoppingList } from './useShoppingList'

const dinner = brand<string, 'SlotKey'>('dinner') as SlotKey
const onion = brand<string, 'IngredientId'>('onion') as IngredientId

/** A Meal of 4 servings needing 2 onions, planned for Wednesday of the test week. */
const setup = async (servingsCooked = 4) => {
  const board = await testBoard()
  const saved = await saveMeal(board.data, randomBytes, {
    name: 'Onion soup',
    servings: brand<number, 'Servings'>(4),
    ingredients: [
      {
        ingredientId: onion,
        quantity: brand<number, 'Quantity'>(2),
        unit: 'pcs',
        optional: false,
      },
    ],
  })
  if (saved.kind !== 'ok') throw new Error('not saved')
  await planMeal(board.data, randomBytes, {
    mealId: saved.value,
    date: '2026-03-11',
    slotKey: dinner,
    servingsCooked: brand<number, 'Servings'>(servingsCooked),
    addedBy: board.engine.view().me,
  })
  const view = await renderHook(() => useShoppingList(testClock), { wrapper: boardWrapper(board) })
  await waitFor(() => {
    expect(view.result.current.hasData).toBe(true)
  })
  return view
}

describe('useShoppingList', () => {
  it('derives the list from what is planned, scaled by Servings Cooked', async () => {
    const view = await setup(8)
    const line = view.result.current.list.buy.find((l) => l.ingredientId === onion)
    expect(line?.amounts[0]).toMatchObject({ quantity: 4, unit: 'pcs' })
    expect(view.result.current.list.sittings).toBe(1)
    expect(view.result.current.isError).toBe(false)
  })

  it('has an empty list, not an error, when nothing is planned for the week', async () => {
    const board = await testBoard()
    const view = await renderHook(() => useShoppingList(testClock), {
      wrapper: boardWrapper(board),
    })
    await waitFor(() => {
      expect(view.result.current.hasData).toBe(true)
    })
    expect(view.result.current.list.buy).toEqual([])
    expect(view.result.current.isError).toBe(false)
  })

  it('ticks a line at once, and unticks it', async () => {
    const view = await setup()
    await act(async () => {
      view.result.current.toggle(onion, true)
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.list.buy.find((l) => l.ingredientId === onion)?.checked).toBe(true)
    })
    await act(async () => {
      view.result.current.toggle(onion, false)
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.list.buy.find((l) => l.ingredientId === onion)?.checked).toBe(
        false,
      )
    })
  })

  it('keeps a line in the cupboard, brings it back when it runs out, and forgets it', async () => {
    const view = await setup()
    await act(async () => {
      view.result.current.keepInCupboard(onion)
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.list.cupboard.some((l) => l.ingredientId === onion)).toBe(true)
    })
    expect(view.result.current.list.buy.some((l) => l.ingredientId === onion)).toBe(false)

    await act(async () => {
      view.result.current.outOf(onion)
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.list.buy.some((l) => l.ingredientId === onion)).toBe(true)
    })

    await act(async () => {
      view.result.current.stopKeeping(onion)
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.list.cupboard).toEqual([])
    })
  })

  it('adds an Extra, ticks it, and ignores an empty one', async () => {
    const view = await setup()
    await act(async () => {
      view.result.current.addItem('Coffee')
      view.result.current.addItem('   ')
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.list.extras.map((e) => e.label)).toEqual(['Coffee'])
    })
    const extra = view.result.current.list.extras[0]
    if (!extra) throw new Error('no extra')
    await act(async () => {
      view.result.current.toggleExtra(extra.id, true)
      // The write finishes a tick later; let it land inside this act.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await waitFor(() => {
      expect(view.result.current.list.extras[0]?.checked).toBe(true)
    })
  })
})
