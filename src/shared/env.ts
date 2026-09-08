import { z } from 'zod'

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

export const readEnv = (source: unknown): Env => envSchema.parse(source)

/**
 * Metro replaces `process.env.EXPO_PUBLIC_*` at each direct member access — it
 * does not build a `process.env` object. Passing `process.env` straight to the
 * schema therefore validates an empty object and throws at startup, so the
 * fields must be named literally here.
 *
 * Both values are public by construction (docs/06-security.md); the service
 * role key is never read in app code, only by scripts/seed-demo.ts.
 */
export const readAppEnv = (): Env => {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment --
     Metro's ProcessEnv declaration and @types/node's merge to `any` here. The
     values are validated by the schema on the next line, which is the point. */
  const source = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment */

  return readEnv(source)
}
