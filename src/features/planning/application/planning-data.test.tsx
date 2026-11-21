import { randomBytes } from '@noble/hashes/utils'
import { testBoard } from '@/test/test-board'
import { brand } from '@/shared/types/brand'
import { isErr, isOk } from '@/shared/types/result'
import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import { dataOf, joinHousehold, type Data } from '@/features/sync'
import {
  addLeftover,
  addToBacklog,
  moveCookEvent,
  moveLeftover,
  planMeal,
  readWeek,
  removeBacklogItem,
  removeLeftover,
  setServingsCooked,
  unplanMeal,
  type MealLook,
} from './planning-data'
import type { WeekStart } from '../domain/types'

const WEEK = brand<string, 'WeekStart'>('2026-03-09') as WeekStart
const NEXT_WEEK = brand<string, 'WeekStart'>('2026-03-16') as WeekStart
const dinner = brand<string, 'SlotKey'>('dinner') as SlotKey
const lunch = brand<string, 'SlotKey'>('lunch') as SlotKey
const tacos = brand<string, 'MealId'>('tacos') as MealId
const four = brand<number, 'Servings'>(4) as Servings
const MEALS = new Map<string, MealLook>([['tacos', { name: 'Tacos', servings: four }]])
const MEMBERS = new Map([['me', { name: 'Sanni', colour: '#5F7355' }]])
const NOW = 1_000

const week = (data: Data, start: WeekStart = WEEK, meals = MEALS) =>
  readWeek(data, start, meals, MEMBERS)
const must = <T,>(r: { kind: string; value?: T; error?: unknown }): T => {
  if (r.kind !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(r.error)}`)
  return r.value as T
}

/** Two Members on one board, each on their own device, in step. */
const twoMembers = async () => {
  const board = await testBoard()
  const invite = must(await board.engine.invite('member'))
  const other = must(await joinHousehold({ ...board.deps, storage: board.deps.storage }, invite))
  const sync = async () => {
    for (const e of [board.engine, other, board.engine]) must(await e.sync())
  }
  return { a: board.data, b: dataOf(other), sync }
}

const direct = (data: Data, date = '2026-03-11') =>
  planMeal(data, randomBytes, {
    mealId: tacos,
    date,
    slotKey: dinner,
    servingsCooked: four,
    addedBy: 'me',
  })

describe('planning on the synced board', () => {
  it('leaves one Backlog Item when two Members unplan the same Cook Event at once', async () => {
    const { a, b, sync } = await twoMembers()
    const cook = must(await direct(a))!
    await sync()
    must(await unplanMeal(a, NOW, cook, 'me'))
    must(await unplanMeal(b, NOW + 1, cook, 'me'))
    await sync()
    expect(week(a).backlog).toHaveLength(1)
    expect(week(b).backlog).toHaveLength(1)
  })

  it('does not bring back a Leftover added while its Meal was off the board', async () => {
    const { a, b, sync } = await twoMembers()
    const cook = must(await direct(a))!
    await sync()
    const item = must(await unplanMeal(a, NOW, cook, 'me'))!
    must(
      await addLeftover(b, randomBytes, { cookEventId: cook, date: '2026-03-12', slotKey: lunch }),
    )
    await sync()
    must(
      await planMeal(a, randomBytes, {
        backlogItemId: item,
        mealId: tacos,
        date: '2026-03-13',
        slotKey: dinner,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )
    await sync()
    expect(week(a).cookEvents).toHaveLength(1)
    expect(week(a).leftovers).toEqual([])
    expect(week(b).leftovers).toEqual([])
  })

  it('keeps a Cook Event in one place when two Members move it at once', async () => {
    const { a, b, sync } = await twoMembers()
    const cook = must(await direct(a))!
    await sync()
    must(await moveCookEvent(a, { cookEventId: cook, date: '2026-03-17', slotKey: dinner }))
    must(await moveCookEvent(b, { cookEventId: cook, date: '2026-03-10', slotKey: lunch }))
    await sync()
    const shown = [...week(a).cookEvents, ...week(a, NEXT_WEEK).cookEvents]
    expect(shown).toHaveLength(1)
    expect([...week(b).cookEvents, ...week(b, NEXT_WEEK).cookEvents]).toEqual(shown)
  })

  it('does not bring back a Cook Event another Member unplanned while this one changed it', async () => {
    const { a, b, sync } = await twoMembers()
    const cook = must(await direct(a))!
    await sync()
    must(await unplanMeal(b, NOW, cook, 'me'))
    await sync()
    must(await setServingsCooked(a, cook, brand(2)))
    must(await moveCookEvent(a, { cookEventId: cook, date: '2026-03-12', slotKey: lunch }))
    await sync()
    expect(week(a).backlog).toHaveLength(1)
    expect(week(a).cookEvents).toEqual([])
    expect(week(b).cookEvents).toEqual([])
  })

  it('does not bring back a Leftover another Member removed while this one moved it', async () => {
    const { a, b, sync } = await twoMembers()
    const cook = must(await direct(a))!
    const left = must(
      await addLeftover(a, randomBytes, { cookEventId: cook, date: '2026-03-12', slotKey: lunch }),
    )
    await sync()
    must(await removeLeftover(b, left))
    await sync()
    must(await moveLeftover(a, { leftoverId: left, date: '2026-03-13', slotKey: lunch }))
    await sync()
    expect(week(a).leftovers).toEqual([])
    expect(week(b).leftovers).toEqual([])
  })

  it('puts a Meal on the Backlog with who wanted it', async () => {
    const { data } = await testBoard()
    must(
      await addToBacklog(data, randomBytes, NOW, { weekStart: WEEK, mealId: tacos, addedBy: 'me' }),
    )
    expect(week(data).backlog).toMatchObject([
      { mealName: 'Tacos', servings: 4, addedByName: 'Sanni', addedByColour: '#5F7355' },
    ])
    expect(week(data, NEXT_WEEK).backlog).toEqual([])
  })

  it('orders the Backlog by when things were added', async () => {
    const { data } = await testBoard()
    const meals = new Map(MEALS).set('soup', { name: 'Soup', servings: four })
    await addToBacklog(data, randomBytes, 20, {
      weekStart: WEEK,
      mealId: brand('soup'),
      addedBy: 'me',
    })
    await addToBacklog(data, randomBytes, 10, { weekStart: WEEK, mealId: tacos, addedBy: 'me' })
    expect(week(data, WEEK, meals).backlog.map((b) => b.mealName)).toEqual(['Tacos', 'Soup'])
  })

  it('plans a Backlog Item: the Item leaves and a Cook Event appears, under one id', async () => {
    const { data } = await testBoard()
    const item = must(
      await addToBacklog(data, randomBytes, NOW, { weekStart: WEEK, mealId: tacos, addedBy: 'me' }),
    )
    const cook = must(
      await planMeal(data, randomBytes, {
        backlogItemId: item,
        mealId: tacos,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )
    expect(cook).toBe(item)
    expect(week(data).backlog).toEqual([])
    expect(week(data).cookEvents).toMatchObject([
      {
        mealName: 'Tacos',
        date: '2026-03-11',
        slotKey: 'dinner',
        servingsCooked: 4,
        addedByName: 'Sanni',
      },
    ])
  })

  it('treats planning an Item someone else already planned as done, not a second Cook Event', async () => {
    const { data } = await testBoard()
    const item = must(
      await addToBacklog(data, randomBytes, NOW, { weekStart: WEEK, mealId: tacos, addedBy: 'me' }),
    )
    const input = {
      backlogItemId: item,
      mealId: tacos,
      date: '2026-03-11',
      slotKey: dinner,
      servingsCooked: four,
      addedBy: 'me',
    }
    await planMeal(data, randomBytes, input)
    expect(must(await planMeal(data, randomBytes, input))).toBeUndefined()
    expect(week(data).cookEvents).toHaveLength(1)
  })

  it('plans straight onto the board, in a week nobody has planned yet', async () => {
    const { data } = await testBoard()
    must(
      await planMeal(data, randomBytes, {
        mealId: tacos,
        date: '2026-03-17',
        slotKey: lunch,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )
    expect(week(data, NEXT_WEEK).cookEvents).toHaveLength(1)
    expect(week(data).cookEvents).toEqual([])
  })

  it('unplans: the Meal returns to the Backlog with its author, and its Leftovers go', async () => {
    const { data } = await testBoard()
    const cook = must(
      await planMeal(data, randomBytes, {
        mealId: tacos,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )
    must(
      await addLeftover(data, randomBytes, {
        cookEventId: cook!,
        date: '2026-03-12',
        slotKey: lunch,
      }),
    )
    must(await unplanMeal(data, NOW, cook!, 'someone-else'))
    const after = week(data)
    expect(after.cookEvents).toEqual([])
    expect(after.leftovers).toEqual([])
    expect(after.backlog).toMatchObject([{ mealName: 'Tacos', addedByName: 'Sanni' }])
  })

  it('can plan the same Backlog Item again after unplanning it', async () => {
    const { data } = await testBoard()
    const item = must(
      await addToBacklog(data, randomBytes, NOW, { weekStart: WEEK, mealId: tacos, addedBy: 'me' }),
    )
    const input = {
      backlogItemId: item,
      mealId: tacos,
      date: '2026-03-11',
      slotKey: dinner,
      servingsCooked: four,
      addedBy: 'me',
    }
    await planMeal(data, randomBytes, input)
    await unplanMeal(data, NOW, item as never, 'me')
    expect(week(data).backlog).toHaveLength(1)
    await planMeal(data, randomBytes, input)
    expect(week(data).backlog).toEqual([])
    expect(week(data).cookEvents).toHaveLength(1)
  })

  it('moves a Cook Event but leaves its Leftovers where they are', async () => {
    const { data } = await testBoard()
    const cook = must(
      await planMeal(data, randomBytes, {
        mealId: tacos,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )!
    const left = must(
      await addLeftover(data, randomBytes, {
        cookEventId: cook,
        date: '2026-03-12',
        slotKey: lunch,
      }),
    )
    await moveCookEvent(data, { cookEventId: cook, date: '2026-03-10', slotKey: lunch })
    await moveLeftover(data, { leftoverId: left, date: '2026-03-13', slotKey: dinner })
    const after = week(data)
    expect(after.cookEvents[0]).toMatchObject({ date: '2026-03-10', slotKey: 'lunch' })
    expect(after.leftovers[0]).toMatchObject({
      date: '2026-03-13',
      slotKey: 'dinner',
      parentMealName: 'Tacos',
    })
  })

  it('moving a Cook Event into another week files it there', async () => {
    const { data } = await testBoard()
    const cook = must(
      await planMeal(data, randomBytes, {
        mealId: tacos,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )!
    await moveCookEvent(data, { cookEventId: cook, date: '2026-03-17', slotKey: dinner })
    expect(week(data).cookEvents).toEqual([])
    expect(week(data, NEXT_WEEK).cookEvents).toHaveLength(1)
  })

  it('changes Servings Cooked, removes one Leftover without touching the Cook Event, and removes a Backlog Item', async () => {
    const { data } = await testBoard()
    const cook = must(
      await planMeal(data, randomBytes, {
        mealId: tacos,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )!
    await setServingsCooked(data, cook, brand<number, 'Servings'>(6))
    const left = must(
      await addLeftover(data, randomBytes, {
        cookEventId: cook,
        date: '2026-03-12',
        slotKey: lunch,
      }),
    )
    await removeLeftover(data, left)
    expect(week(data).cookEvents[0]?.servingsCooked).toBe(6)
    expect(week(data).leftovers).toEqual([])
    const item = must(
      await addToBacklog(data, randomBytes, NOW, { weekStart: WEEK, mealId: tacos, addedBy: 'me' }),
    )
    await removeBacklogItem(data, item)
    expect(week(data).backlog).toEqual([])
  })

  it('hides what was planned from a Meal that is gone, and its Leftovers with it', async () => {
    const { data } = await testBoard()
    const cook = must(
      await planMeal(data, randomBytes, {
        mealId: tacos,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )!
    await addLeftover(data, randomBytes, { cookEventId: cook, date: '2026-03-12', slotKey: lunch })
    await addToBacklog(data, randomBytes, NOW, { weekStart: WEEK, mealId: tacos, addedBy: 'me' })
    const none = week(data, WEEK, new Map())
    expect(none).toEqual({ cookEvents: [], leftovers: [], backlog: [] })
  })

  it('stops at the caps the database used to enforce', async () => {
    const { data } = await testBoard()
    const cook = must(
      await planMeal(data, randomBytes, {
        mealId: tacos,
        date: '2026-03-11',
        slotKey: dinner,
        servingsCooked: four,
        addedBy: 'me',
      }),
    )!
    for (let i = 0; i < 20; i++) {
      must(
        await addLeftover(data, randomBytes, {
          cookEventId: cook,
          date: '2026-03-12',
          slotKey: lunch,
        }),
      )
    }
    const over = await addLeftover(data, randomBytes, {
      cookEventId: cook,
      date: '2026-03-12',
      slotKey: lunch,
    })
    expect(isErr(over) && over.error).toBe('limit-reached')
  })

  it('leaves out rows another Member wrote that make no sense', async () => {
    const { data } = await testBoard()
    await data.put('cook', 'junk', {
      week: WEEK,
      mealId: 'tacos',
      date: 'x',
      slot: 1,
      servings: 'many',
    })
    await data.put('backlog', 'junk', { nope: true })
    await data.put('leftover', 'junk', {})
    expect(week(data)).toEqual({ cookEvents: [], leftovers: [], backlog: [] })
    expect(
      isOk(
        await addToBacklog(data, randomBytes, NOW, {
          weekStart: WEEK,
          mealId: tacos,
          addedBy: 'me',
        }),
      ),
    ).toBe(true)
  })
})
