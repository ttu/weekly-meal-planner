import { compareHlc, type Hlc } from './hlc'

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

/**
 * Last-writer-wins per field. Pure, and idempotent and order-independent, which
 * is what lets events arrive twice, late, or out of order and still converge.
 */
export const applyEvents = (store: Store, events: readonly SyncEvent[]): Store =>
  events.reduce<Store>((acc, event) => {
    const current = acc[event.entity]?.[event.field]
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
  store[entity]?.[field]?.value
