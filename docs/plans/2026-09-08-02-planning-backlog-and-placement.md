# Planning — Backlog and Placement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Member signs in, adds a Meal to this week's Backlog, plans it onto a
day and Slot, and adds Leftovers — the loop the whole app exists for.

**Architecture:** Continues plan 01. Vertical slices, pure domain, RLS as the
sole authorization point. Writes go through TanStack Query mutations that
invalidate the week query; realtime is plan 06, so the board refreshes on
mutation rather than on a subscription.

**Tech Stack:** As plan 01 — Expo Router, TypeScript strict, Supabase, TanStack
Query, Zod, i18next, Jest + pglite, Storybook, Maestro.

**Spec:** `docs/01-functional-spec.md`, plus `docs/07-design-system.md` for the
board and plan-sheet designs and ADRs 0002, 0004, 0009.

## What each task delivers

| Task | Openable and checkable                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | **Sign in with an email link.** You reach the board as a real Member; the demo anon policies are deleted and the board is empty when signed out. |
| 2    | **The Backlog shelf**, docked below the board, showing seeded Backlog Items with who added them.                                                 |
| 3    | **Add a Meal to the Backlog** — tap +, pick from the library, it appears with your name on it.                                                   |
| 4    | **Plan it.** Tap a Backlog card → "Plan for…" → day, Slot, servings → it lands on the board and leaves the Backlog.                              |
| 5    | **Leftovers** — from the plan sheet and from a planned card.                                                                                     |
| 6    | **Unplan and remove** — a planned Meal returns to the Backlog; a Backlog Item can be dropped.                                                    |

Every task ends with a step that says: run the app and use it.

## Global Constraints

Everything in plan 01's Global Constraints still applies — the glossary, the ten
rules, strict TypeScript, RLS-only authorization, both Locales, semantic theme
tokens, amber for the Backlog only, conventional commits, `pnpm run` always.

New for this plan:

- **Writes are optimistic where the outcome is certain** (adding to the Backlog,
  planning a card) and pessimistic where it is not. Every mutation invalidates
  `['week', householdId, weekStart]`.
- **Never block a Member's edit.** Two Meals in one Slot is supported; the plan
  sheet says so rather than refusing.
- **No new user-facing string without both `fi` and `en`.**
- **Every interactive control needs a `testID` and an accessibility label.**
- Work on `feat/02-planning`, never on `main`.

---

### Task 1: Sign-in, membership bootstrap, and deleting the demo policies

**Deliverable:** sign in with an email link and reach the board as a real
Member. Sign out and the board is empty — because the temporary anon read
policies are gone.

**Files:**

- Create: `src/features/household/application/sign-in.ts`,
  `src/features/household/ui/SignInScreen.tsx`,
  `src/features/household/ui/useAuthSession.ts`,
  `src/app/sign-in.tsx`
- Delete: `supabase/migrations/20260908999999_demo_anon_read.sql`
- Modify: `src/app/_layout.tsx`, `src/features/household/index.ts`,
  `scripts/seed-demo.ts`, `docs/06-security.md`
- Test: `src/test/db/rls-anon.test.ts`

**Interfaces:**

- Consumes: `AppSupabaseClient`, `loadHousehold`, `SessionProvider` (plan 01)
- Produces:
  - `useAuthSession(client): { userId: string | undefined; isLoading: boolean }`
  - `signInWithEmail(client, email): Promise<Result<void, SignInError>>`

- [ ] **Step 1: Write the failing anon-isolation test**

Create `src/test/db/rls-anon.test.ts`. This is the test the deleted demo
policies would break:

```ts
import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'

describe('anonymous access', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await createTestDb()
    await db.asOwner()
    const [h] = (await db.sql(
      "insert into household (name) values ('Alice household') returning id",
    )) as { id: string }[]
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Aino', '#5F7355')`,
      [h!.id, ALICE],
    )
    await db.sql("insert into meal (household_id, name, servings) values ($1, 'Chili', 4)", [h!.id])
  })

  afterAll(async () => {
    await db.close()
  })

  // A signed-out client has no auth.uid(), so app.is_member is false for every
  // Household. Nothing may leak.
  it('shows no Household to a client with no identity', async () => {
    await db.asAnon()
    expect(await db.sql('select id from household')).toHaveLength(0)
  })

  it('shows no Household Meal to a client with no identity', async () => {
    await db.asAnon()
    expect(await db.sql('select id from meal where household_id is not null')).toHaveLength(0)
  })

  it('still shows Catalogue Meals, which are public by design', async () => {
    await db.asOwner()
    await db.sql("insert into meal (household_id, name, servings) values (null, 'Shakshuka', 2)")
    await db.asAnon()
    expect(await db.sql('select id from meal where household_id is null')).toHaveLength(1)
  })
})
```

Add `asAnon` to `src/test/db/harness.ts`, alongside `asMember` and `asOwner`:

```ts
    asAnon: async () => {
      await db.exec('set role anon;')
      await db.query('select set_config($1, $2, false)', ['app.current_user_id', ''])
    },
```

and to its `TestDb` type:

```ts
/** Run as a signed-out client: role anon, no auth.uid(). */
asAnon: () => Promise<void>
```

The `anon` role needs the same grants as `authenticated` — add it to the grant
block in the harness:

```ts
await db.exec(`
    grant usage on schema public, app to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated, anon;
    grant execute on all functions in schema app to authenticated, anon;
  `)
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- rls-anon`
Expected: FAIL on the first two tests — the demo policies still grant `anon`
read access to everything. That is the point: this test is what makes deleting
them verifiable.

- [ ] **Step 3: Delete the demo policies**

```bash
rm supabase/migrations/20260908999999_demo_anon_read.sql
pnpm exec supabase db reset
pnpm run db:seed
```

Run: `pnpm test -- rls-anon`
Expected: PASS, 3 tests.

Remove the "Temporary demo policy" section from `docs/06-security.md` — it has
served its purpose and a stale warning is worse than none.

- [ ] **Step 4: Seed a real auth user**

The seed currently invents Member `user_id`s that match no auth user, so nobody
can sign in as them. Change `scripts/seed-demo.ts` to create real auth users
through the admin API and use their ids:

```ts
const DEMO_PASSWORD = 'meal-planner-demo'

const MEMBERS = [
  { email: 'aino@example.test', displayName: 'Aino', colour: '#5F7355', role: 'owner' },
  { email: 'sanni@example.test', displayName: 'Sanni', colour: '#C05A38', role: 'member' },
  { email: 'mikko@example.test', displayName: 'Mikko', colour: '#4A6670', role: 'member' },
]

/** Real auth users, so the demo Household can actually be signed into. Local
 *  only: these credentials never exist outside a developer machine. */
const seedAuthUsers = async (): Promise<Map<string, string>> => {
  const { data: existing } = await admin.auth.admin.listUsers()
  for (const user of existing.users) await admin.auth.admin.deleteUser(user.id)

  const emailToId = new Map<string, string>()
  for (const member of MEMBERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: member.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error !== null) fail(`Auth user ${member.email}`, error.message)
    emailToId.set(member.email, data.user.id)
  }
  return emailToId
}
```

Use the returned ids when inserting `household_member`, and print the sign-in
credentials at the end so the next person does not have to read the script.

- [ ] **Step 5: Build the auth session hook**

Create `src/features/household/ui/useAuthSession.ts`:

```ts
import { useEffect, useState } from 'react'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

export type AuthSession = {
  readonly userId: string | undefined
  readonly isLoading: boolean
}

export const useAuthSession = (client: AppSupabaseClient): AuthSession => {
  const [session, setSession] = useState<AuthSession>({ userId: undefined, isLoading: true })

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => {
      setSession({ userId: data.session?.user.id, isLoading: false })
    })

    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      setSession({ userId: next?.user.id, isLoading: false })
    })

    // Unsubscribing matters: this listener outlives the screen otherwise, and
    // subscriptions are one of the few real leak sources in this app.
    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [client])

  return session
}
```

- [ ] **Step 6: Sign-in use case and screen**

Create `src/features/household/application/sign-in.ts`:

```ts
import { ok, err, type Result } from '@/shared/types/result'
import type { AppSupabaseClient } from '../infrastructure/supabase-client'

export type SignInError = 'invalid-credentials' | 'unavailable'

/**
 * Password sign-in for now. An email link needs deep-link handling and a
 * configured mail sender, which belongs with the deployment work rather than
 * here; the seeded demo users have known passwords.
 */
export const signIn = async (
  client: AppSupabaseClient,
  email: string,
  password: string,
): Promise<Result<void, SignInError>> => {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error === null) return ok(undefined)
  return err(error.status === 400 ? 'invalid-credentials' : 'unavailable')
}

export const signOut = async (client: AppSupabaseClient): Promise<void> => {
  await client.auth.signOut()
}
```

Create `src/features/household/ui/SignInScreen.tsx` — email field, password
field, submit, and an inline error. All strings through `t()`, both Locales.
Every control gets a `testID` and an `accessibilityLabel`. Use the theme tokens:
`surface` ground, `action` for the submit button, `body` type.

Add these keys to both locale files:

```
auth.title            Sign in            Kirjaudu sisään
auth.email            Email address      Sähköpostiosoite
auth.password         Password           Salasana
auth.submit           Sign in            Kirjaudu
auth.invalid          That email and password do not match.
                      Sähköposti ja salasana eivät täsmää.
auth.unavailable      Could not reach the server. Try again.
                      Palvelimeen ei saatu yhteyttä. Yritä uudelleen.
auth.signOut          Sign out           Kirjaudu ulos
```

- [ ] **Step 7: Route on auth state**

Create `src/app/sign-in.tsx` rendering `SignInScreen`, and in `_layout.tsx`
redirect to it when `useAuthSession` reports no `userId`, once loading is done.
Load the Household only when signed in.

Add a sign-out control to the board header — without it you cannot test the
signed-out state, and you will need it constantly.

- [ ] **Step 8: Run it and use it**

```bash
pnpm exec supabase db reset && pnpm run db:seed
pnpm run start
```

Check:

- signed out, you land on the sign-in screen, not an empty board
- signing in as `aino@example.test` shows the Koivisto board in Finnish
- signing out returns to sign-in, and the board is not visible behind it
- a wrong password shows the translated inline error, not a crash

- [ ] **Step 9: Validate and commit**

```bash
pnpm run validate
git add -A
git commit -m "feat(household): sign-in, auth session, and removal of the demo anon policies

- rls-anon.test.ts asserts a signed-out client sees no Household and no
  Household Meal, only Catalogue Meals
- Seed creates real auth users so the demo Household can be signed into
- The temporary demo read policies are deleted, as scheduled in plan 01"
```

---

### Task 2: The Backlog shelf

**Deliverable:** a docked shelf below the board showing this week's Backlog
Items, each with the display name and colour of the Member who added it.

**Files:**

- Create: `src/features/planning/domain/backlog.ts`,
  `src/features/planning/infrastructure/backlog-repository.ts`,
  `src/features/planning/ui/BacklogShelf.tsx`,
  `src/features/planning/ui/BacklogShelf.stories.tsx`
- Modify: `src/features/planning/ui/useWeekBoard.ts`,
  `src/features/planning/ui/BoardScreen.tsx`,
  `src/features/planning/index.ts`, `scripts/seed-demo.ts`
- Test: `src/features/planning/ui/BacklogShelf.test.tsx`

**Interfaces:**

- Produces:
  - `type BacklogItem = { id: BacklogItemId; mealId: MealId; mealName: string; addedByName: string; addedByColour: string }`
  - `loadBacklog(client, weekPlanId): Promise<Result<readonly BacklogItem[], LoadBacklogError>>`
  - `<BacklogShelf items onAdd onPlan />`

- [ ] **Step 1: Extend the seed with Backlog Items**

Add to `seedWeek`, after the Cook Events, using the Member ids from Task 1:

```ts
const { error: backlogError } = await admin.from('backlog_item').insert([
  {
    week_plan_id: weekPlanId,
    meal_id: mealId('Tacos'),
    added_by: memberIds.get('sanni@example.test'),
  },
  {
    week_plan_id: weekPlanId,
    meal_id: mealId('Munavoileivät'),
    added_by: memberIds.get('mikko@example.test'),
  },
])
if (backlogError !== null) fail('Backlog Items', backlogError.message)
```

- [ ] **Step 2: Write the failing BacklogShelf test**

Cover: renders each item's Meal name; shows who added it; renders an empty state
when there are none; the add control is reachable by `testID`.

- [ ] **Step 3: Implement the repository**

`backlog_item` joined to `meal(name)` and `household_member(display_name,colour)`.
`added_by` is a `user_id`, so the join is on
`household_member(user_id, household_id)` — note in the code that it is not a
foreign key to `household_member` because a Member can leave while their
Backlog Item stays, and the card should still say who wanted it.

- [ ] **Step 4: Implement BacklogShelf**

A horizontally scrolling shelf of `MealCard variant="backlog"`, docked below the
board and visible at every scroll position, with a count and an add button. The
empty state reads "Nobody has added anything yet" / "Kukaan ei ole vielä
lisännyt mitään", not a blank strip.

- [ ] **Step 5: Wire it into the board and look at it**

Extend `useWeekBoard` to return `backlog`. Render the shelf in `BoardScreen`.

Run the app. Check: two Backlog cards, amber-edged, showing Sanni and Mikko;
they stay visible while you scroll the week.

- [ ] **Step 6: Validate and commit**

---

### Task 3: Add a Meal to the Backlog

**Deliverable:** tap +, choose a Meal from the library, and it appears in the
Backlog with your name on it.

**Files:**

- Create: `src/features/meals/ui/MealPicker.tsx`,
  `src/features/meals/ui/MealPicker.stories.tsx`,
  `src/features/planning/application/add-to-backlog.ts`,
  `src/features/planning/ui/useAddToBacklog.ts`
- Modify: `src/features/meals/index.ts`, `src/features/planning/index.ts`,
  `src/features/planning/ui/BoardScreen.tsx`
- Test: `src/features/meals/ui/MealPicker.test.tsx`,
  `src/test/db/backlog-write.test.ts`

**Interfaces:**

- Produces:
  - `<MealPicker meals onSelect onDismiss />`
  - `addToBacklog(client, { weekPlanId, mealId, addedBy }): Promise<Result<BacklogItemId, AddToBacklogError>>`
  - `useAddToBacklog(): { add: (mealId: MealId) => void; isPending: boolean }`

- [ ] **Step 1: Integration test for the write**

Against pglite: a Member can insert a Backlog Item into their own Week Plan and
cannot insert one into another Household's. The second case is the one that
matters.

- [ ] **Step 2: MealPicker**

A searchable sheet listing Household Meals first, then Catalogue Meals badged as
such. Own Meals render as `MealCard variant="library"`. Search matches on name,
case- and diacritic-insensitively — "aa" must find "Uunilohi ja perunamuusi" and
"Munavoileivät" must be findable by typing "munavoi".

Empty search results get their own state, not a blank list.

- [ ] **Step 3: The mutation**

A TanStack Query mutation that inserts the Backlog Item and invalidates the week
query. Optimistic: the card appears immediately with the current Member's name,
and rolls back on error with a translated message.

`week_plan` may not exist yet for this week — nobody has planned it. The mutation
creates it on demand rather than failing, which is why `addToBacklog` takes a
`weekStart` and resolves the plan id itself.

- [ ] **Step 4: Run it and use it**

Add three Meals to the Backlog. Check they appear immediately, carry your
display name and colour, survive a reload, and that adding the same Meal twice
is allowed — wanting tacos twice is not an error.

- [ ] **Step 5: Validate and commit**

---

### Task 4: Plan a Backlog Item onto a day and Slot

**Deliverable:** the core loop. Tap a Backlog card, choose day, Slot and
servings, and it lands on the board and leaves the Backlog.

**Files:**

- Create: `src/features/planning/domain/placement.ts`,
  `src/features/planning/ui/PlanSheet.tsx`,
  `src/features/planning/ui/PlanSheet.stories.tsx`,
  `src/features/planning/application/plan-meal.ts`,
  `src/features/planning/ui/usePlanMeal.ts`
- Test: `src/features/planning/domain/placement.test.ts`,
  `src/features/planning/ui/PlanSheet.test.tsx`,
  `src/test/db/plan-write.test.ts`

**Interfaces:**

- Produces:
  - `describePlacement(input): PlacementDescription` — pure; what the sheet says
  - `planMeal(client, { backlogItemId, mealId, weekPlanId, date, slotKey, servingsCooked }): Promise<Result<CookEventId, PlanMealError>>`

- [ ] **Step 1: The pure placement description**

`describePlacement({ board, date, slotKey })` returns what the sheet should tell
the Member — specifically whether the target Slot already holds Meals:

```ts
export type PlacementDescription = {
  readonly existingCount: number
  readonly willJoinExisting: boolean
}
```

Tests: zero existing gives `willJoinExisting: false`; one or more gives `true`
and the right count; an unconfigured Slot key gives zero rather than throwing.

This exists as a pure function because the message it drives — "Tuesday dinner
already has 2 Meals. Yours will join them." — is the app's clearest statement
that it will not refuse an edit, and it deserves a test.

- [ ] **Step 2: PlanSheet**

Day selector (seven chips, today marked), Slot selector from the Household's
configured Slots, a servings stepper defaulting to the Meal's own servings, the
join-existing notice when relevant, and a primary "Put it on Tuesday" button
whose label names the chosen day.

New locale keys, both languages:

```
plan.title            Plan "{{meal}}"          Suunnittele "{{meal}}"
plan.addedBy          Added by {{name}} · serves {{servings}}
                      Lisännyt {{name}} · {{servings}} annosta
plan.day              Day                      Päivä
plan.slot             Slot                     Ateria
plan.cookingFor       Cooking for              Valmistetaan
plan.willJoin         {{slot}} already has {{count}} Meals. Yours will join them.
                      {{slot}} sisältää jo {{count}} ateriaa. Sinun tulee niiden rinnalle.
plan.submit           Put it on {{day}}        Lisää {{day}}
plan.cancel           Cancel                   Peruuta
```

- [ ] **Step 3: The mutation**

Insert the Cook Event and delete the Backlog Item in one operation. These must
not half-happen — a Backlog Item deleted without its Cook Event loses the Meal
from the week entirely. Use an RPC (`plan_meal`) so Postgres makes it atomic;
two client-side statements cannot be.

```sql
create or replace function app.plan_meal(
  p_backlog_item_id uuid,
  p_week_plan_id uuid,
  p_meal_id uuid,
  p_date date,
  p_slot_key text,
  p_servings_cooked integer
) returns uuid
language plpgsql
security invoker  -- runs as the caller, so RLS still applies
as $fn$
declare
  new_id uuid;
begin
  insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked,
                          from_backlog_item_id)
  values (p_week_plan_id, p_meal_id, p_date, p_slot_key, p_servings_cooked,
          p_backlog_item_id)
  returning id into new_id;

  delete from backlog_item where id = p_backlog_item_id;

  return new_id;
end;
$fn$;
```

`security invoker` is deliberate: the function must not become a way around RLS.

- [ ] **Step 4: Run it and use it**

Plan a Meal onto Tuesday dinner where a Meal already sits. Check the sheet says
it will join, both cards appear, the Backlog loses the item, and a reload agrees.
Then plan onto an empty Wednesday lunch and confirm the dashed line is replaced.

- [ ] **Step 5: Validate and commit**

---

### Task 5: Leftovers

**Deliverable:** create a Leftover from the plan sheet at placement time, and
from a planned card afterwards.

**Files:**

- Create: `src/features/planning/application/add-leftover.ts`,
  `src/features/planning/ui/useAddLeftover.ts`
- Modify: `src/features/planning/ui/PlanSheet.tsx`,
  `src/features/planning/ui/DayColumn.tsx`
- Test: `src/test/db/leftover-write.test.ts`

- [ ] **Step 1: Integration test**

A Member can add a Leftover to their own Cook Event and not to another
Household's. Deleting the parent still removes it (already covered in plan 01,
but assert it again from the write path).

- [ ] **Step 2: The plan-sheet path**

An "Add leftovers" affordance in the sheet that, after placing, opens a second
day/Slot choice. Placing a Leftover on the same Slot as its parent is allowed but
pointless — warn rather than refuse.

- [ ] **Step 3: The planned-card path**

An action on `MealCard variant="planned"` opening the same day/Slot chooser.

Locale keys:

```
leftover.add          Add leftovers            Lisää tähteet
leftover.sameSlot     That is the same sitting as the Meal itself.
                      Se on sama ateriahetki kuin ruoka itse.
```

- [ ] **Step 4: Run it and use it**

Cook something for six on Monday, add Leftovers to Wednesday lunch, check the
inset dashed card names its parent. Then delete the Monday Cook Event and watch
the Leftover go with it — in the UI, not just in SQL.

- [ ] **Step 5: Validate and commit**

---

### Task 6: Unplan and remove

**Deliverable:** a planned Meal can go back to the Backlog, and a Backlog Item
can be dropped.

**Files:**

- Create: `src/features/planning/application/unplan-meal.ts`,
  `src/features/planning/application/remove-backlog-item.ts`
- Modify: `src/features/planning/ui/DayColumn.tsx`,
  `src/features/planning/ui/BacklogShelf.tsx`
- Test: `src/test/db/unplan-write.test.ts`

- [ ] **Step 1: The reverse RPC**

`app.unplan_meal(cook_event_id)` recreates the Backlog Item and deletes the Cook
Event atomically, cascading its Leftovers. The Member who originally added it is
lost when the Backlog Item is deleted, so `cook_event` gains an `added_by`
column carried through planning — otherwise unplanning silently reassigns
authorship, which the Backlog card would then display as a lie.

- [ ] **Step 2: Confirm before destroying**

Unplanning takes Leftovers with it. When a Cook Event has dependents, the
confirmation says how many, in both Locales:

```
unplan.confirmWithLeftovers   This also removes {{count}} leftover cards.
                              Tämä poistaa myös {{count}} tähdekorttia.
```

- [ ] **Step 3: Run it and use it**

- [ ] **Step 4: Validate and commit**

---

## Self-Review

**Spec coverage.** Backlog with `added_by` shown ✓ (Tasks 2–3); planning onto
day and Slot ✓ (Task 4); non-exclusive Slots surfaced rather than refused ✓
(Task 4); tap-to-plan as the phone path ✓ (Task 4 — drag is plan 07);
Leftovers from both entry points ✓ (Task 5); unplanning ✓ (Task 6); RLS as sole
authorization point ✓ (every write test); both Locales ✓.

**Deliberately deferred.** Drag-and-drop and the three-pane wide layout (plan
07); realtime and presence (plan 06); the Meal editor and catalogue copy flow
(plan 03); Shopping List (plan 04).

**Known risk.** Task 4's RPC and Task 6's reverse RPC are the only places two
tables must change together. Both are `security invoker` so RLS still applies;
if either becomes `security definer` for convenience, the sole-enforcement-point
guarantee is gone and ADR 0002 is violated.

**Schema change introduced mid-plan.** Task 6 adds `cook_event.added_by`. It is
called out here rather than left as a surprise, and Task 4 must set it when
planning, so the two tasks are coupled — do not reorder them.
