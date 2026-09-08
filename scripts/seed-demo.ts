import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '../src/shared/db/database.types'

// Validated at the edge like every other external input. The service role key
// is deliberately not EXPO_PUBLIC_: it must never reach the app bundle.
const env = z
  .object({
    EXPO_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  })
  .parse(process.env)

const admin = createClient<Database>(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

/**
 * Member colours exclude backlog amber, which means "wanted but unplanned" and
 * must not be diluted by appearing on a person (docs/07-design-system.md).
 */
const MEMBERS = [
  {
    userId: '00000000-0000-0000-0000-000000000001',
    displayName: 'Aino',
    colour: '#5F7355',
    role: 'owner',
  },
  {
    userId: '00000000-0000-0000-0000-000000000002',
    displayName: 'Sanni',
    colour: '#C05A38',
    role: 'member',
  },
  {
    userId: '00000000-0000-0000-0000-000000000003',
    displayName: 'Mikko',
    colour: '#4A6670',
    role: 'member',
  },
]

const fail = (what: string, message: string): never => {
  throw new Error(`${what}: ${message}`)
}

const seed = async (): Promise<void> => {
  // Cascades clear members; explicit for readability.
  await admin.from('household').delete().neq('id', NIL_UUID)

  const { data: household, error } = await admin
    .from('household')
    .insert({ name: 'Koivisto', locale: 'fi' })
    .select('id')
    .single()
  if (error !== null) fail('Household', error.message)

  const householdId = (household as { id: string }).id

  const { error: memberError } = await admin.from('household_member').insert(
    MEMBERS.map((m) => ({
      household_id: householdId,
      user_id: m.userId,
      role: m.role,
      display_name: m.displayName,
      colour: m.colour,
    })),
  )
  if (memberError !== null) fail('Members', memberError.message)

  process.stdout.write(`Seeded Household ${householdId} with ${String(MEMBERS.length)} Members\n`)
}

void seed()
