import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '@/shared/env'
import type { Database } from '@/shared/db/database.types'

/**
 * Parameterised by the generated schema types. Without them every query result
 * is `any`, the strict lint rules reject it, and a column rename becomes a
 * runtime surprise instead of a type error.
 *
 * Regenerate with `pnpm run db:types` after any migration.
 */
export type AppSupabaseClient = SupabaseClient<Database>

/**
 * A factory, not a module-level singleton — the client is injected through
 * SessionProvider so tests can supply their own.
 */
export const createSupabaseClient = (env: Env): AppSupabaseClient =>
  createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
