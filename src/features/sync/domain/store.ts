import { compareHlc, isValidHlc, type Hlc } from './hlc'

/** JSON without `null`: this codebase uses `undefined` for "no value". */
export type FieldValue =
  string | number | boolean | readonly FieldValue[] | { readonly [key: string]: FieldValue }

/** One write to one field of one entity. A delete is a write to a field too. */
export type SyncEvent = {
  readonly id: string
  readonly hlc: Hlc
  readonly entity: string
  readonly field: string
  readonly value: FieldValue
}

type Cell = { readonly hlc: Hlc; readonly value: FieldValue }
export type Store = { readonly [entity: string]: { readonly [field: string]: Cell } }

export const emptyStore: Store = {}

const NAME = /^[A-Za-z][\w:-]*$/
const RESERVED = new Set(['__proto__', 'constructor', 'prototype'])

/** Events come from other Members, who may be hostile: reject what could corrupt the store. */
const isAcceptable = (event: SyncEvent): boolean =>
  isValidHlc(event.hlc) &&
  [event.entity, event.field].every((n) => NAME.test(n) && !RESERVED.has(n))

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
