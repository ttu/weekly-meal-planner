# 04 — Testing

Test diamond: **~70% integration, ~20% E2E, ~10% unit.** Unit means pure logic
only; E2E means critical flows only.

This is a correction to an earlier draft of the functional spec, which put the
heaviest coverage on unit tests for the shopping-list aggregation. The
aggregation is pure and deserves thorough unit tests — but it is small, and
thoroughness there is cheap. The bulk of the risk in this app is collaboration:
RLS policies, realtime reconciliation, the offline queue, and the catalogue sync
script. Those are integration tests.

## Integration — the bulk

Run against **pglite**: real Postgres, in-process, no container, fast enough for
the pre-commit hook. Not SQLite — this schema uses `jsonb`, check constraints
calling functions, and RLS, none of which SQLite would honour.

What pglite does not give us is Supabase's auth layer, so `auth.uid()` is
provided by a test shim that reads a session-local setting. Tests set the
current member and then exercise the real policies. This is the one place we
knowingly diverge from production, and it is documented here so nobody discovers
it while debugging.

Testcontainers is reserved for anything where vendor-specific behaviour actually
matters — realtime replication, storage — and is not part of the default loop.

**One drift risk to know about.** The harness loads `supabase/schemas/*.sql`,
while the running database is built from `supabase/migrations/*.sql`. Migrations
are generated from the schema files, so they normally agree — but a policy added
only to a migration is invisible to every test. Anything that must be proven
absent has to be checked against a real database as well, not only in pglite.

Covered here:

- **RLS, adversarially.** A test proving a member reads their own household
  proves nothing. The tests that count: household A cannot read, update or
  delete household B's rows, across every table; a catalogue meal cannot be
  edited by any household; leaving a household revokes access immediately; a
  cook event cannot be inserted into another household's week plan.
- **Feature use cases** against a real database with real repositories — plan a
  backlog item, add a leftover, delete a cook event and watch its leftovers go,
  copy a catalogue meal and confirm the copy is independent of the original.
- **The catalogue sync script** — the reference data in `data/` loads, validates
  and applies idempotently.
- **The offline write queue** — queued writes flush in order and converge.

## Unit — pure logic only

The shopping-list derivation, and the unit conversion beneath it:

- scaling by `servingsCooked / servings`
- conversion within a dimension; mixed dimensions staying as separate lines
- leftovers contributing zero
- staples filtered out of Buy, present in Cupboard Check
- `running_low` promoting a staple into Buy
- overrides winning, with their reason preserved
- a meal with no ingredients producing the incomplete-meal line
- ISO week boundaries, with an injected clock

Mutation testing (Stryker) is scoped to exactly this pure logic and runs on a
schedule, not per-commit. Gaps it finds are closed with behaviour tests, never
with tests written to kill a mutant.

## E2E — critical flows only

Playwright against the web build (`pnpm run test:e2e`), in `e2e/`. Maestro on a
device build covers the same flow when a native change warrants it. One flow is
mandatory:

start a board → add a Meal to the Backlog → plan it on a day → drag a second one
onto a Slot → see both on the Shopping List → copy the agent prompt.

Selectors are `data-testid` only, or `getByRole`/`aria-label` for interactive
controls. Never CSS classes, text content or structural position — the copy is
translated and the layout has a breakpoint, so both would be lying.

### One page per spec

An anonymous board lives entirely in browser storage, and Playwright gives each
test a fresh context. A spec that tells one story therefore shares one page
(`openSharedPage`, `test.describe.configure({ mode: 'serial' })`); a test that
needs its own board calls `asNewVisitor` and creates one.

### Drag needs real mouse moves

`dragTo` sends too few pointer events for a gesture recogniser to activate.
`dragOnto` in `e2e/fixtures.ts` walks the pointer across in twenty steps, which
is what react-native-gesture-handler is waiting to see.

### `count()` does not retry

Playwright's auto-waiting lives in `expect`, not in `Locator.count()`. Wait for
`expect(rows.first()).toBeVisible()` before counting, or the count is of
whatever had rendered by that microsecond.

## Not unit-tested

Realtime sync and presence. Both are dominated by integration behaviour and are
verified with two real clients and airplane mode. Mocked sockets test the mock.

## Also run

- **Accessibility** — axe on rendered components, plus `eslint-plugin-jsx-a11y`
  as the floor. Manual keyboard testing for the board and the plan sheet.
- **Storybook story smoke tests** — every story renders without error.
- **Visual regression** in the vendor's container image, so a font difference on
  a laptop is not a failing build.

## Coverage policy

Project coverage `target: auto`, never decreasing. Hard floor of **80% on the
patch** — new code carries its own tests or the build fails. Coverage is a
ratchet, not a goal; nothing here is satisfied by a test that asserts nothing.

## Mocking

Only at system boundaries: network, filesystem, clock, randomness, third-party
SDKs. Inside the system, real collaborators. A test that mocks
`features/planning` to test `features/shopping` is testing our assumptions about
planning, which is exactly what integration tests exist to check.
