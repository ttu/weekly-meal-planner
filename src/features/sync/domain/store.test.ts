import type { Hlc } from './hlc'
import { MAX_DRIFT_MS } from './hlc'
import { applyEvents, emptyStore, readField, type SyncEvent } from './store'

const NOW = 1_000

const at = (wall: number, node = 'a', counter = 0): Hlc => ({ wall, counter, node })
const set = (id: string, hlc: Hlc, entity: string, field: string, value: unknown): SyncEvent => ({
  id,
  receivedAt: NOW,
  hlc,
  entity,
  field,
  value: value as SyncEvent['value'],
})

describe('applyEvents', () => {
  it('keeps the later write when two Members edit the same field', () => {
    const early = set('1', at(1, 'a'), 'meal:x', 'title', 'Soup')
    const late = set('2', at(2, 'b'), 'meal:x', 'title', 'Stew')
    expect(readField(applyEvents(emptyStore, [early, late]), 'meal:x', 'title')).toBe('Stew')
  })

  it('reaches the same state whatever order events arrive in', () => {
    const events = [
      set('1', at(1, 'a'), 'meal:x', 'title', 'Soup'),
      set('2', at(2, 'b'), 'meal:x', 'title', 'Stew'),
      set('3', at(2, 'a'), 'meal:x', 'title', 'Curry'),
    ]
    const forward = applyEvents(emptyStore, events)
    const backward = applyEvents(emptyStore, [...events].reverse())
    expect(backward).toEqual(forward)
  })

  it('is unchanged when the same event arrives twice', () => {
    const event = set('1', at(1), 'meal:x', 'title', 'Soup')
    const once = applyEvents(emptyStore, [event])
    expect(applyEvents(once, [event])).toEqual(once)
  })

  it('merges different fields of one entity instead of overwriting the whole thing', () => {
    const store = applyEvents(emptyStore, [
      set('1', at(1, 'a'), 'meal:x', 'title', 'Soup'),
      set('2', at(2, 'b'), 'meal:x', 'servings', 4),
    ])
    expect(readField(store, 'meal:x', 'title')).toBe('Soup')
    expect(readField(store, 'meal:x', 'servings')).toBe(4)
  })

  it('treats a delete as a write, so a later edit can bring an entity back', () => {
    const store = applyEvents(emptyStore, [
      set('1', at(1), 'meal:x', 'title', 'Soup'),
      set('2', at(2), 'meal:x', 'deleted', true),
      set('3', at(3), 'meal:x', 'deleted', false),
    ])
    expect(readField(store, 'meal:x', 'deleted')).toBe(false)
  })

  it('reads undefined for a field nobody has written', () => {
    expect(readField(emptyStore, 'meal:x', 'title')).toBeUndefined()
  })

  it('does not mutate the store it was given', () => {
    const before = applyEvents(emptyStore, [set('1', at(1), 'meal:x', 'title', 'Soup')])
    const snapshot = JSON.stringify(before)
    applyEvents(before, [set('2', at(2), 'meal:x', 'title', 'Stew')])
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('applyEvents with a hostile writer', () => {
  const good = set('1', at(1), 'meal:x', 'title', 'Soup')

  it.each(['__proto__', 'constructor', 'prototype'])(
    'ignores events that name the reserved key %s instead of throwing',
    (name) => {
      const store = applyEvents(emptyStore, [
        set('2', at(2), name, 'title', 'x'),
        set('3', at(3), 'meal:x', name, 'x'),
        good,
      ])
      expect(readField(store, 'meal:x', 'title')).toBe('Soup')
      expect(readField(store, name, 'title')).toBeUndefined()
      expect(Object.keys(store)).toEqual(['meal:x'])
    },
  )

  it('ignores events whose clock is malformed, so one cannot freeze a field', () => {
    const poison = set('2', { wall: Number.NaN, counter: 0, node: 'evil' }, 'meal:x', 'title', 'x')
    const store = applyEvents(emptyStore, [
      poison,
      good,
      set('3', at(2), 'meal:x', 'title', 'Stew'),
    ])
    expect(readField(store, 'meal:x', 'title')).toBe('Stew')
  })

  it('does not let an inherited property pose as an existing cell', () => {
    const store = applyEvents(emptyStore, [set('1', at(1), 'meal:x', 'valueOf', 'x'), good])
    expect(readField(store, 'meal:x', 'title')).toBe('Soup')
  })
})

describe('applyEvents with malformed or implausible events', () => {
  const good = set('1', at(1), 'meal:x', 'title', 'Soup')
  const raw = (partial: object): SyncEvent => ({ ...good, ...partial })

  it('drops an event stamped far in the future, so it cannot win a field for good', () => {
    const future = set('2', at(NOW + MAX_DRIFT_MS + 1), 'meal:x', 'title', 'Pwned')
    const store = applyEvents(emptyStore, [
      good,
      future,
      set('3', at(2), 'meal:x', 'title', 'Stew'),
    ])
    expect(readField(store, 'meal:x', 'title')).toBe('Stew')
  })

  it.each([
    ['null clock', { hlc: null }],
    ['numeric node', { hlc: { wall: 1, counter: 0, node: 7 } }],
    ['huge counter', { hlc: { wall: 1, counter: 1e9, node: 'a' } }],
    ['overlong node', { hlc: { wall: 1, counter: 0, node: 'n'.repeat(500) } }],
    ['numeric entity', { entity: 7 }],
    ['numeric field', { field: 7 }],
    ['overlong entity', { entity: 'e'.repeat(500) }],
  ])('skips an event with a %s instead of throwing', (_name, bad) => {
    const store = applyEvents(emptyStore, [raw(bad), good])
    expect(readField(store, 'meal:x', 'title')).toBe('Soup')
  })
})

describe('applyEvents is deterministic', () => {
  it('judges an event by when the relay got it, not by when this device merges it', () => {
    const early = { ...set('1', at(NOW + MAX_DRIFT_MS + 1), 'meal:x', 'title', 'Pwned') }
    const honest = { ...early, receivedAt: NOW + 10 }
    expect(readField(applyEvents(emptyStore, [early]), 'meal:x', 'title')).toBeUndefined()
    expect(readField(applyEvents(emptyStore, [honest]), 'meal:x', 'title')).toBe('Pwned')
  })

  it('skips an event whose receive time is malformed', () => {
    const bad = { ...set('1', at(1), 'meal:x', 'title', 'x'), receivedAt: Number.NaN }
    expect(applyEvents(emptyStore, [bad])).toEqual(emptyStore)
  })
})
