# 04 — Testing

Test diamond: **~70% integration, ~20% E2E, ~10% unit.** Unit means pure logic
only; E2E means critical flows only.

This is a correction to an earlier draft of the functional spec, which put the
heaviest coverage on unit tests for the shopping-list aggregation. The
aggregation is pure and deserves thorough unit tests — but it is small, and
thoroughness there is cheap. The bulk of the risk in this app is collaboration:
convergence of several devices, the relay's rules, the membership log and the
offline queue. Those are integration tests.

## Integration — the bulk

Run against **the real engine over a relay in memory**. `src/test/memory-relay.ts`
runs the actual relay code (`relay/`) behind the actual HTTP client, so a test
covers the wire too; the only things faked are the network (an `online` switch)
and the device's storage. `src/test/test-board.tsx` starts a real board on it and
gives hooks a provider with that board open (`boardWrapper` adds the week on
screen). Nothing about planning, meals or shopping is mocked: a test writes rows,
or calls the hook's action, and reads what the screen would see.

The relay's own tests (`relay/relay.test.ts`) call its HTTP-shaped entry point
over in-memory storage with the same contract a Durable Object has. Neither the
Worker wrapper (`relay/worker.ts`) nor a real Cloudflare deployment is covered
here: that is checked by hand (`pnpm dlx wrangler dev`).

Randomness and the clock are injected, so the protocol tests are deterministic
(`fakeRandom`); the slice tests use real randomness, because they assert on
behaviour, not on ids.

Covered here:

- **The protocol, adversarially.** Several devices converge on the same data; a
  Member removed by an admin can read and write nothing after the removal while
  everyone else carries on; a hostile Member cannot stall the others with garbage
  records, poison the store with `__proto__`-style names, or win a field with a
  far-future clock; two admins acting at once give `conflict` to the loser; the
  relay refuses a wrong token, a stale epoch, a replayed old token and every
  malformed input, and an old token reads only up to its rotation.
- **Feature use cases** over a real board — plan a Backlog Item, add a Leftover,
  unplan and watch the Leftovers go, copy a Catalogue Meal and confirm the copy is
  independent, delete a Meal and watch what was planned from it drop off.
- **Rows another Member wrote that make no sense** are left out, never thrown on.
- **The Catalogue's data** — `scripts/catalogue-schema.test.ts` validates
  `data/catalogue/` as a whole, and `meals/domain/catalogue.test.ts` checks both
  Locales and every unit against its Ingredient's dimension.
- **The offline queue** — writes made offline are sent in order and converge.

## Unit — pure logic only

The shopping-list derivation, and the unit conversion beneath it:

- scaling by `servingsCooked / servings`
- conversion within a dimension; mixed dimensions staying as separate lines
- leftovers contributing zero
- staples filtered out of Buy, present in Cupboard Check
- `running_low` promoting a staple into Buy
- overrides winning, with their reason preserved
- a meal with no ingredients producing the incomplete-meal line
- ISO week boundaries and the current day, with an injected clock. The week and
  "today" follow the local day, so `jest.global-setup.js` pins the suite to
  `Europe/Helsinki`; write instants with that offset in mind.

Mutation testing (Stryker) is scoped to exactly this pure logic and runs on a
schedule, not per-commit. Gaps it finds are closed with behaviour tests, never
with tests written to kill a mutant.

## E2E — critical flows only

Playwright against the web app, in `e2e/` (config: `playwright.config.ts`),
run with `pnpm run e2e`. It is part of `validate:all` (so pre-push) and its own
CI job.

The relay is the real relay code (`relay/worker.ts`) served from memory by
`e2e/global-setup.ts` on port 8788, so the suite needs no Cloudflare account and
every run starts from an empty relay. The web app runs on port 8098 with
`EXPO_PUBLIC_RELAY_URL` pointing at it. Those are not the dev ports (8099, and
8787 for `wrangler dev`), so a running dev server is never reused by mistake.
Locally, an e2e server already on 8098 is reused; delete nothing, it is all in
memory.

Covered, one spec each: planning a Meal and seeing its Ingredients on the
Shopping List; writing a Household Meal and planning it; two Members sharing a
board through the relay until an admin removes one; a recovery link on a new
device; every screen translated in `en` and `fi`, with no raw keys; the phone
layout's picker and plan sheet; starting a board from the keyboard alone; and the development demo board. Not covered yet:
drag and drop, Leftovers, Staples and Extras on the Shopping List, dark mode.

A browser context is a device: a board lives in its storage. A test with two
Members opens two contexts (`newDevice` in `e2e/fixtures.ts`).

Selectors are `data-testid` only, or `getByRole`/`aria-label` for interactive
controls. Never CSS classes, text content or structural position — the copy is
translated and the layout has a breakpoint, so both would be lying.

A drag needs real mouse moves: walk the pointer across in about twenty steps,
which is what react-native-gesture-handler waits to see. `Locator.count()` does
not retry, so assert with `toHaveCount` instead. Never wait a fixed time
(`sonarjs/no-fixed-wait-in-tests` is on for `e2e/`). The poll is 15 s while the
board is busy and 2 minutes when quiet: once a device has written, wait about two
busy ticks for another Member's change, or reload the page (a start syncs).

## Demo board for development

There are no accounts, so there are no test logins. Instead, a development build
(`__DEV__`) shows **Fill a demo board** under the Start screen. Run a local relay
and the web app, then press it:

```
pnpm dlx wrangler dev --config relay/wrangler.toml   # :8787
EXPO_PUBLIC_RELAY_URL=http://127.0.0.1:8787 pnpm run web
```

It builds the board `Koivisto` through the same application functions the screens
use (`src/dev/demo-board.ts`): Aino (admin, this device), Sanni and Mikko, this
week planned with a Leftover, a wish from each Member on the Backlog, one
Household Meal, three Staples with cumin Running Low, and two Extras. The panel
then lists one link per Member. To be Sanni or Mikko, open that link in a
private window or another browser. The links carry each Member's keys, so
they are shown on screen and never logged. Each press makes a new board; the
local relay's state lives in `relay/.wrangler/` (ignored), and deleting it
starts over.

## Not unit-tested

Reconnection behaviour on a real network: the loop retrying after the relay is
unreachable, and the app resuming from the background. The engine's offline
paths are tested with the `online` switch; losing signal mid-session is checked
by hand with two real clients and airplane mode.

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
