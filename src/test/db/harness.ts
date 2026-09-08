import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type TestDb = {
  sql: (query: string, params?: unknown[]) => Promise<unknown[]>
  /** Run as a role subject to RLS, with auth.uid() resolving to `userId`. */
  asMember: (userId: string) => Promise<void>
  /** Run as the table owner, which policies do not apply to. Fixture setup only. */
  asOwner: () => Promise<void>
  close: () => Promise<void>
}

// Order matters: the auth shim must exist before policies that call auth.uid().
const SCHEMA_FILES = [
  'supabase/schemas/00_extensions.sql',
  'supabase/schemas/10_household.sql',
  'src/test/db/auth-shim.sql',
  'supabase/schemas/90_policies_household.sql',
]

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8')

export const createTestDb = async (): Promise<TestDb> => {
  const db = new PGlite()

  // Supabase provides these roles; pglite does not. They must exist before the
  // schema loads, because policies name them in `to authenticated`.
  await db.exec('create role authenticated nologin; create role anon nologin;')

  for (const file of SCHEMA_FILES) await db.exec(read(file))

  // Policies do not apply to the table owner, so tests must run as a role that
  // is subject to them — exactly as anon/authenticated are in production.
  await db.exec(`
    grant usage on schema public, app to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema app to authenticated;
  `)

  return {
    sql: async (query, params = []) => (await db.query(query, params)).rows,
    asMember: async (userId) => {
      await db.exec('set role authenticated;')
      await db.query('select set_config($1, $2, false)', ['app.current_user_id', userId])
    },
    asOwner: async () => {
      await db.exec('reset role;')
    },
    close: () => db.close(),
  }
}
