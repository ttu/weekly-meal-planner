import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type TestDb = {
  sql: (query: string, params?: unknown[]) => Promise<unknown[]>
  /** Run as a role subject to RLS, with auth.uid() resolving to `userId`. */
  asMember: (userId: string) => Promise<void>
  /** Run as the table owner, which policies do not apply to. Fixture setup only. */
  asOwner: () => Promise<void>
  /** Run as a signed-out client: role anon, no auth.uid(). */
  asAnon: () => Promise<void>
  close: () => Promise<void>
}

// Order matters: the auth shim must exist before policies that call auth.uid().
const SCHEMA_FILES = [
  'supabase/schemas/00_extensions.sql',
  'supabase/schemas/05_extensions_crypto.sql',
  // Before anything that reads a secret: SQL function bodies are checked on
  // creation, so vault.decrypted_secrets must already exist.
  'src/test/db/vault-shim.sql',
  'supabase/schemas/12_beta_key.sql',
  'supabase/schemas/10_household.sql',
  'supabase/schemas/11_household_sharing.sql',
  'supabase/schemas/20_meals.sql',
  'supabase/schemas/30_planning.sql',
  'supabase/schemas/50_shopping.sql',
  'src/test/db/auth-shim.sql',
  'supabase/schemas/90_policies_household.sql',
  'supabase/schemas/91_policies_meals.sql',
  'supabase/schemas/92_policies_planning.sql',
  'supabase/schemas/40_planning_rpc.sql',
  'supabase/schemas/41_meal_rpc.sql',
  'supabase/schemas/42_sharing_rpc.sql',
  'supabase/schemas/93_policies_shopping.sql',
  'supabase/schemas/95_limits.sql',
]

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8')

export const createTestDb = async (): Promise<TestDb> => {
  // pgcrypto so board password hashing is exercised for real, not stubbed.
  const db = new PGlite({ extensions: { pgcrypto } })

  // Supabase provides these roles; pglite does not. They must exist before the
  // schema loads, because policies name them in `to authenticated`.
  await db.exec('create role authenticated nologin; create role anon nologin;')
  await db.exec('create schema if not exists extensions;')

  for (const file of SCHEMA_FILES) await db.exec(read(file))

  // Policies do not apply to the table owner, so tests must run as a role that
  // is subject to them — exactly as anon/authenticated are in production.
  await db.exec(`
    grant usage on schema public, app, auth, extensions to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated, anon;
    grant execute on all functions in schema app to authenticated, anon;
    grant execute on all functions in schema auth to authenticated, anon;
    grant execute on all functions in schema extensions to authenticated, anon;
    grant execute on all functions in schema public to authenticated, anon;
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
    asAnon: async () => {
      await db.exec('set role anon;')
      await db.query('select set_config($1, $2, false)', ['app.current_user_id', ''])
    },
    close: () => db.close(),
  }
}
