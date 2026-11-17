import { compareHlc, isPlausibleHlc, type Hlc } from './hlc'

/** JSON without `null`: this codebase uses `undefined` for "no value". */
export type FieldValue =
  string | number | boolean | readonly FieldValue[] | { readonly [key: string]: FieldValue }

/** One write to one field of one entity. A delete is a write to a field too. */
export type SyncEvent = {
  readonly id: string
  /**
   * When the relay first received the event, set by the relay, not by the
   * writer. Every replica sees the same value, so judging an event against it
   * gives every replica the same verdict.
   */
  readonly receivedAt: number
  readonly hlc: Hlc
  readonly entity: string
  readonly field: string
  readonly value: FieldValue
}

type Cell = { readonly hlc: Hlc; readonly value: FieldValue }
export type Store = { readonly [entity: string]: { readonly [field: string]: Cell } }

export const emptyStore: Store = {}

const NAME = /^[A-Za-z][\w:-]*$/
const MAX_NAME_LENGTH = 128
const RESERVED = new Set(['__proto__', 'constructor', 'prototype'])

const isName = (n: unknown): n is string =>
  typeof n === 'string' && n.length <= MAX_NAME_LENGTH && NAME.test(n) && !RESERVED.has(n)

/** Events come from other Members, who may be hostile: reject what could corrupt the store. */
const isAcceptable = (event: SyncEvent): boolean =>
  isPlausibleHlc(event.hlc, event.receivedAt) && isName(event.entity) && isName(event.field)

const own = (store: Store, entity: string, field: string): Cell | undefined => {
  const cells = Object.hasOwn(store, entity) ? store[entity] : undefined
  return cells && Object.hasOwn(cells, field) ? cells[field] : undefined
}

/**
 * Last-writer-wins per field. Pure, and idempotent and order-independent, which
 * is what lets events arrive twice, late, or out of order and still converge.
 */
export const applyEvents = (store: Store, events: readonly SyncEvent[]): Store =>
  events.reduce<Store>((acc, event) => {
    if (!isAcceptable(event)) return acc
    const current = own(acc, event.entity, event.field)
    if (current && compareHlc(event.hlc, current.hlc) <= 0) return acc
    return {
      ...acc,
      [event.entity]: {
        ...acc[event.entity],
        [event.field]: { hlc: event.hlc, value: event.value },
      },
    }
  }, store)

export const readField = (store: Store, entity: string, field: string): FieldValue | undefined =>
  own(store, entity, field)?.value
