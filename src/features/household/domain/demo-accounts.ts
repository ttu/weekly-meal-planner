/**
 * The logins `pnpm run db:seed` creates, named once so the seed and the dev
 * sign-in shortcuts cannot drift apart. Changing a name or an address here
 * changes both.
 *
 * These are not secrets. They exist on a developer machine and nowhere else:
 * the seed deletes every auth user before it writes them, which is only
 * survivable locally, and `.test` is a reserved domain that cannot resolve.
 * The sign-in screen still only offers them when `__DEV__` is true, because a
 * list of working logins on a production screen is a bad habit whatever the
 * passwords are.
 */
export type DemoAccount = {
  readonly email: string
  readonly displayName: string
  readonly password: string
  /** Shown beside the name, so it is obvious which one owns the board. */
  readonly role: 'owner' | 'member'
  readonly colour: string
}

/**
 * The password `db:seed` gives all three accounts.
 *
 * Hard-coded on purpose and flagged as such by the linter, which is right to
 * ask: this is a credential in app source. It is safe because it is not a
 * credential to anything — it opens accounts that exist only where someone
 * has run the seed against their own local Supabase, on a reserved `.test`
 * domain that cannot resolve. Assume the string survives into a production
 * bundle, because nothing guarantees it is stripped; what keeps it harmless
 * is that the accounts do not exist anywhere but a developer's machine.
 */
// eslint-disable-next-line sonarjs/no-hardcoded-passwords -- opens local seed accounts only; see above
export const DEMO_PASSWORD = 'meal-planner-demo'

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: 'aino@example.test',
    displayName: 'Aino',
    password: DEMO_PASSWORD,
    role: 'owner',
    colour: '#5F7355',
  },
  {
    email: 'sanni@example.test',
    displayName: 'Sanni',
    password: DEMO_PASSWORD,
    role: 'member',
    colour: '#C05A38',
  },
  {
    email: 'mikko@example.test',
    displayName: 'Mikko',
    password: DEMO_PASSWORD,
    role: 'member',
    colour: '#4A6670',
  },
]
