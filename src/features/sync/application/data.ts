import type { FieldValue, Store } from '../domain/store'
import type { Engine } from './engine'

/** One row's fields. Plain JSON, no `null`. */
export type Doc = { readonly [field: string]: FieldValue }
export type Row = { readonly id: string; readonly doc: Doc }

/**
 * What a feature sees of the synced board: rows of a kind, by id. Each field is
 * its own write underneath, so two people editing different fields of one row
 * both keep their change. A removed row is a `deleted` field, never a gap.
 */
export type Data = {
  readonly list: (kind: string) => readonly Row[]
  readonly get: (kind: string, id: string) => Doc | undefined
  /** Writes only the fields given; the row's other fields are untouched. A removed row comes back. */
  readonly put: (kind: string, id: string, fields: Doc) => Promise<void>
  readonly remove: (kind: string, id: string) => Promise<void>
}

const entityOf = (kind: string, id: string): string => `${kind}:${id}`

export const dataOf = (engine: Pick<Engine, 'view' | 'write'>): Data => {
  const read = (store: Store, entity: string): Doc | undefined => {
    const cells = Object.hasOwn(store, entity) ? store[entity] : undefined
    if (!cells) return undefined
    const doc = Object.fromEntries(
      Object.entries(cells).map(([field, cell]) => [field, cell.value]),
    )
    return doc.deleted === true ? undefined : doc
  }
  return {
    get: (kind, id) => read(engine.view().store, entityOf(kind, id)),
    list: (kind) => {
      const prefix = `${kind}:`
      const { store } = engine.view()
      return Object.keys(store)
        .filter((entity) => entity.startsWith(prefix))
        .flatMap((entity) => {
          const doc = read(store, entity)
          return doc ? [{ id: entity.slice(prefix.length), doc }] : []
        })
    },
    put: async (kind, id, fields) => {
      const entity = entityOf(kind, id)
      const cells = Object.hasOwn(engine.view().store, entity)
        ? engine.view().store[entity]
        : undefined
      for (const [field, value] of Object.entries(fields)) {
        await engine.write(entity, field, value)
      }
      // Writing to a removed row brings it back: a Meal moved off the Backlog and
      // back again is the same row, not a second one.
      if (cells?.deleted?.value === true) await engine.write(entity, 'deleted', false)
    },
    remove: (kind, id) => engine.write(entityOf(kind, id), 'deleted', true),
  }
}
