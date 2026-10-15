# 01 — Functional Specification

Date: 2026-08-29
Status: Approved, reconciled with the visual design, ready for implementation
planning

Visual design: Claude Design project _Meal Planner_
(`76fb2d88-5564-44c1-95c0-9a3f0d660448`), file
`Meal Planner - Design Direction.dc.html`. Sections there cover foundations,
card variants, phone board, empty states, wide screen and shopping list. Where
this spec and the canvas disagree, the canvas wins on appearance and this spec
wins on behaviour.

## Purpose

Menami (menami.app, ADR 0011) is a shared weekly meal board for a household. Anyone in the family adds meals they
fancy to a weekly backlog; someone then places those meals on specific days and
slots. The week's plan produces a shopping list, which leaves the app as text a
browser AI agent can act on, or as items in the shopping list the household
already uses.

The design constraint that outranks the others: planning a week takes two
minutes. Any feature that makes it take longer is a feature this app does not
have.

## Decisions

| Area             | Decision                                                          |
| ---------------- | ----------------------------------------------------------------- |
| Sharing          | Hosted app, shared household account                              |
| Platform         | Expo (React Native), iOS/Android, web target via react-native-web |
| Backend          | Supabase — Postgres, auth, RLS, realtime                          |
| Leftovers        | Cook once, plus explicit leftover cards linked to the cook event  |
| Pantry           | Staples flag with a "running low" check, no quantity inventory    |
| Meal source      | Household library plus a curated public catalogue                 |
| Catalogue link   | Adding from the catalogue copies into the household library       |
| Day structure    | Slots configurable per household                                  |
| Shopping list    | Computed in the app as pure TypeScript functions                  |
| Agent handoff    | Copy-as-prompt and OS share in v1; App Intents next               |
| Visual direction | Warm paper ground, ink type, one earth accent (see canvas)        |
| Languages        | Finnish and English from the first commit, catalogue in both      |

### Backend cost position

Supabase free tier: 500 MB database, 5 GB egress/month, 50,000 MAU, no backups,
projects paused after a week of inactivity. Estimated footprint is ~0.5 MB per
household-year, so database size and egress bind at roughly 1,000 households;
MAU never binds. The reason to move to Pro ($25/month, 8 GB, daily backups) is
**backups**, and it arrives long before any quota does.

Monetisation is a v1 non-goal. Ad revenue would plausibly cover $25/month
somewhere in the low hundreds of households, but the EU consent platform work,
the $100 AdMob payout threshold and the cost to a shared kitchen app's feel are
not worth it at that scale.

## Glossary — ubiquitous language

This glossary is the single source of naming. Every term here appears verbatim
(in the language's casing convention) in types, file names, database columns,
tests and commit scopes. If code needs a concept that is not here, add it here
first.

| Term                | Meaning                                                                                                                  | Not called                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **Household**       | The group sharing one board. One per account in v1.                                                                      | family, group, team                         |
| **Member**          | A person in a household, with a display name and colour.                                                                 | user (reserve `user` for the auth identity) |
| **Slot**            | A named division of a day — lunch, dinner. Configured per household.                                                     | meal time, period                           |
| **Week Plan**       | One household's plan for one ISO week.                                                                                   | week, schedule                              |
| **Meal**            | A named dish with servings and ingredients.                                                                              | recipe, dish                                |
| **Catalogue Meal**  | A meal in the shared public library (`household_id IS NULL`).                                                            | template, public recipe                     |
| **Household Meal**  | A meal owned by one household, possibly copied from a Catalogue Meal.                                                    | custom meal, own recipe                     |
| **Backlog Item**    | A meal wanted this week, not yet dated. Carries who added it.                                                            | wish, idea, draft                           |
| **Cook Event**      | A meal placed on a day and slot, with servings cooked. The only thing that contributes ingredients.                      | plan entry, scheduled meal                  |
| **Leftover**        | A card on another slot referencing a Cook Event. Contributes no ingredients. Born beside its parent, dragged from there. | leftover entry, repeat                      |
| **Servings**        | How many the meal recipe yields.                                                                                         | portions, yield                             |
| **Servings Cooked** | How many are actually being made at a Cook Event. Surfaced as "Cooking N".                                               | batch size, quantity                        |
| **Ingredient**      | A canonical shopping-list-able thing, with a category and a dimension.                                                   | item, product                               |
| **Dimension**       | Mass, volume or count. Quantities convert only within one.                                                               | unit type                                   |
| **Staple**          | An ingredient the household normally has in, declared from a Buy Line's "we always have this in". Kept off the Buy list. | pantry item, household ingredient           |
| **Running Low**     | A staple flagged as needing replacement; promotes it to Buy.                                                             | out of stock, empty                         |
| **Shopping List**   | The derived output for a Week Plan. Never stored.                                                                        | groceries, basket                           |
| **Buy Line**        | One aggregated row on the Shopping List.                                                                                 | list item                                   |
| **Cupboard Check**  | The Shopping List section listing this week's Staples.                                                                   | pantry check                                |
| **Extra**           | A manually added Shopping List item belonging to no Meal.                                                                | custom item                                 |
| **Override**        | A manually set quantity on a Buy Line, with an optional reason.                                                          | manual quantity                             |
| **Provenance**      | The per-Meal breakdown behind a Buy Line's quantity.                                                                     | source, breakdown                           |
| **Agent Prompt**    | The copyable text handing the Shopping List to a browser AI agent. Generated in the household's Locale.                  | export, share text                          |
| **Locale**          | `fi` or `en`. Set per Household in Settings; English until someone chooses otherwise.                                    | language, i18n                              |
| **Slug**            | An Ingredient's stable, locale-independent identity.                                                                     | key, code                                   |

Two renames applied when this glossary was adopted: `plan_entry` became
**Cook Event** and `leftover_entry` became **Leftover**, because the UI, the
design and every conversation already used those words. The database columns,
TypeScript types and feature folders follow.

## Domain model

All tables are scoped by `household_id` and gated by RLS on household
membership, except the global catalogue rows.

### Household and identity

- **`household`** — name, and `slots`: an ordered list of
  `{key, labelKey, label?}`, defaulting to lunch and dinner. Edited in Settings
  — add a preset, name one of your own, reorder, remove — so a single person
  isn't staring at an empty breakfast row all week. `labelKey` is a translation
  key; `label` is set only for a slot the household named itself, which is
  monolingual by nature. Removing a slot never deletes what was planned in it:
  the board stops drawing the row, and putting the slot back brings the meals
  into view again. At most six, which is what a phone's day column can hold.
- **`household_member`** — user to household, with role `owner` or `member`,
  plus `display_name`, optional `avatar_url` and an assigned `colour`. The
  design puts a person's initial and colour on every backlog and planned card
  ("Dad wants this"), so these are load-bearing, not decoration.

One household per user account in v1.

### Ingredients

- **`ingredient`** — canonical name, `category` (produce, dairy, dry goods…),
  `dimension` (mass / volume / count), and a base unit. `household_id` is
  nullable: `NULL` means global, otherwise the row is a household's own
  addition.

Category and dimension live on the ingredient rather than on the meal, so
aggregation and shop-aisle ordering work regardless of which meal contributed
the line.

### Meals

- **`meal`** — name, description, `servings`, optional source URL and photo.
  The photo is picked from the device in the Meal editor and lives in the
  private `meal-photo` bucket as `<household id>/<meal id>`; `photo_url` holds
  that path, and the app signs a URL for an hour when it needs to show one. An
  absolute URL in the column is left alone, so a Catalogue Meal may point at a
  picture we do not host.
  `household_id NULL` means public catalogue; otherwise it belongs to that
  household.
- **`meal_ingredient`** — meal, ingredient, `quantity`, `unit`, `optional` flag.
  A check constraint requires the unit to be convertible within the ingredient's
  dimension.

A meal may legitimately have **no ingredients**. The day-one quick-add chips
("+ Tacos", "+ Pancakes") create a meal from a name alone — name it now,
ingredients later — because friction on the first screen is what loses a
household. The debt surfaces where it matters: see the shopping list's
incomplete-meal line.

Adding a public meal to a household inserts a **copy**, retaining
`copied_from_meal_id` for provenance. The family's copy is theirs to edit, and
catalogue edits never silently change a planned week or a shopping list.

### The week

- **`week_plan`** — household plus ISO week start date.
- **`backlog_item`** — a meal parked in that week's backlog, with `added_by`.
  Holds no date. This is the "everyone adds their favourite" list.
- **`cook_event`** — the cook event: date, slot, meal, `servings_cooked`, and
  the `backlog_item` it came from. The only thing that contributes ingredients.
- **`leftover`** — references a parent `cook_event`, plus its own date and
  slot. Contributes nothing to the shopping list. Deleting the parent cascades,
  so a leftover card can never be stranded.

`cook_event` and `leftover` are separate tables rather than one table with
a nullable parent: a leftover has no servings and no meal of its own, and
merging them puts an "is this real?" branch in every query.

`servings_cooked` is retained even under the simpler leftovers model, because it
is what tells a family whether one batch plausibly covers three cards. It is
displayed, never enforced.

### Pantry

- **`household_staple`** — household, ingredient, `running_low`,
  `marked_low_at`. Presence means "we normally have this": excluded from the buy
  list, surfaced in the check-stock section instead. `running_low = true` pushes
  it back onto the buy list.

## The board

### Two surfaces

- **Backlog** — a shelf of meal cards for the week, no dates, each showing who
  added it. The low-commitment half: "I'd like tacos this week" costs one tap
  and no negotiation.
- **Board** — days as columns, each day showing the household's configured
  slots. Dragging a backlog card onto a slot creates a `cook_event` and removes
  it from the backlog; dragging back returns it.

### Layout

On wide screens (above ~1024px), three panes in one view: **meal library** on
the left (household meals and public catalogue, searchable), **this week's
backlog** in the centre, **the board** on the right. Dragging works pane to
pane, including library straight to board when you already know it's Thursday.

Below the breakpoint this collapses to the phone flow — board with a backlog
shelf, library behind a picker — and the direct library-to-board path
disappears, leaving the backlog as the deliberate middle step. One component
tree with a breakpoint, not two apps.

### Phone interaction

Dragging across a seven-day grid on a phone is awkward, so every drag has a tap
equivalent: tap a backlog card, choose "Plan for…", pick day and slot. Drag is
the accelerator on wide screens, never the only path. The board scrolls one day
at a time on narrow screens, with a week strip at the top.

### Leftovers

Leftovers can be created two ways: from the "Plan for…" sheet at placement time
(which also carries the "cooking for N" stepper), or afterwards from the planned
card's "add leftovers" action. Both produce a leftover card to place on a later
slot. Leftover cards render as a lighter variant naming their parent
("Chili — leftovers"); tapping one jumps to the cook event. The parent shows
`servings_cooked` against the number of cards depending on it, as information.
The app never blocks claiming four dinners from one pot.

### Realtime and conflicts

Supabase realtime subscriptions on `backlog_item`, `cook_event` and
`leftover`, scoped to the current `week_plan`. Writes go to Postgres with
an optimistic local update; the subscription reconciles.

**Presence** is a second, separate channel (Supabase Realtime Presence, not row
changes): who is looking at this week, and which day they are editing. The
design surfaces it as member avatars in the header, an "Aino is editing
Thursday" line, and a two-second sage hairline on a day that just changed. No
toasts, no scroll jumps — a change someone else made must never move the card
under your thumb.

Slots are **not exclusive** — a day-slot holds more than one entry. When two
people drop different meals on Tuesday dinner at once, both land and the family
sorts it out visually. Refusing a household member's edit is worse than showing
two cards on Tuesday. Deleting an entry someone is mid-drag on resolves
last-write-wins, with the dragged card snapping back.

### Offline

The week's data is cached locally; reads work offline, writes queue and flush on
reconnect. Not CRDT sync — for a board whose realistic offline window is minutes
and whose conflicts are additive, a queue is enough.

## The week on screen

The board opens on this week and the arrows either side of the heading move it
a week at a time; the heading says which week is on screen and offers the way
back. A household plans the week ahead at least as often as the one underway —
on a Sunday evening "this week" is nearly over — and the board could previously
only ever show the current seven days.

The Shopping List follows the same week. They are two views of one Week Plan,
and shopping for a week other than the one being looked at is not a thing
anybody wants.

## Shopping list

### Derivation

For a given `week_plan`: take every `cook_event` (leftovers contribute nothing,
being already paid for by the cook event), expand to `meal_ingredient` rows,
scale each quantity by `servings_cooked / meal.servings`, convert to the
ingredient's base unit, and sum per ingredient.

Implemented as pure functions over plain data:
`(planEntries, mealIngredients, staples, overrides) -> ShoppingList`. No I/O, so
every rule is directly testable.

### Units

Conversion happens only within a dimension. 200 g + 0.5 kg sums; 200 g + 2 tbsp
does not, and is listed as separate lines on one ingredient ("flour: 500 g +
2 tbsp"). Guessing that a tablespoon of flour is 8 g is how a shopping list
quietly becomes wrong; a family reading the list resolves it in a second.

### Output sections

1. **Buy** — non-staple ingredients, plus staples marked running low. Grouped by
   ingredient category, so the list follows the shop rather than the recipes.
2. **Check the cupboard** — the week's staples not marked low, each with a
   "we're out" tap that moves it into Buy. This is what stops the cumin problem
   without demanding inventory bookkeeping.
3. **Extras** — manually added items belonging to no meal.

A planned meal with no ingredients yet gets its own line in Buy — "Tacos — no
ingredients yet" — linking straight to the meal editor. It is the only honest
way to have a zero-friction day one without silently handing a family an
incomplete list.

### Persistence

The list is derived and never stored; it recomputes on render. Stored per week:
checked-off state, extras, and quantity overrides (each with an optional
one-line `reason`, shown under the terracotta-underlined quantity so nobody
wonders why the arithmetic looks wrong). Storing the derived list
would mean it going stale the moment someone changes Thursday's dinner —
precisely when it must not.

### Provenance

Each line expands to show which meals contributed and how much. "Why four
onions?" is one tap from an answer, and an over-quantity becomes obvious before
the till.

### Shopping in progress

Ticking items off is local-first and syncs: the row changes on the tap, from
the cache, and the write follows. A shop is where this screen is used and a
shop is where the signal goes, so a tap that waited for the server looked
ignored and got repeated. While the device is offline the list says so at the
top and keeps taking taps. Ticked rows grey out and strike
through but **stay in place**; the list never reflows under a moving thumb. A
collapsed "show ticked items" control keeps the count. If someone edits the plan
mid-shop, new items appear at the bottom flagged as added.

Row ergonomics come from the canvas and are requirements, not styling: 19px
rows, 28px checkboxes, 54px minimum row height, and the whole row is the tap
target. This list is used one-handed, in a shop, sometimes with gloves on.

## Getting the list out

Four exits, ordered by cost to build.

1. **Copy as agent prompt** — text designed for pasting into a browser agent:
   store name if set, items as `quantity unit — name` grouped by category, and
   the household's substitution rules appended ("prefer organic milk", "no
   pork"). Works with every agent that exists today; costs a template. Ships
   first.
2. **Share sheet and exports** — OS share with the list as text, plus "send to
   Reminders" on iOS. Reminders is the genuinely native answer for a shopping
   list: items land in the list the household already shares and get ticked off
   in the shop without opening this app. Likely the most-used feature here.
3. **App Intents** — what makes "hey Siri, what do I need to buy?", Shortcuts
   automations, and Apple Intelligence access possible. Two intents suffice:
   _Get shopping list_ and _Add item to shopping list_.

   Apple Intelligence cannot reach into an arbitrary app's data; the app must
   offer it. App Intents are Swift and need a native target, so this requires an
   Expo config plugin and a development build — it does not work in Expo Go and
   commits the project to EAS builds. The extension runs as a separate process
   and cannot call the TypeScript aggregation, so the app writes a JSON snapshot
   of the current list into a shared App Group container whenever the list
   changes, and the intent reads that snapshot. Slightly stale in the worst
   case, correct in every realistic one.

   Android's equivalent is a share target plus App Actions; treated as a later
   follow-up, not parity work.

4. **Read-only web link** — a token-scoped public route rendering the week's
   list, for the family member without the app and the agent that would rather
   be handed a URL.

**Scope:** 1 and 2 in v1. 3 immediately after, once a real household is using it
and the dev-build workflow is justified. 4 only on request.

## Testing

Full strategy in `04-testing.md`. In summary, and correcting an earlier draft of
this section: the weighting is a **test diamond** — roughly 70% integration, 20%
E2E, 10% unit — not unit-heavy.

The earlier draft put the heaviest coverage on unit tests for the shopping-list
derivation. That derivation is pure and does deserve thorough tests, but it is
small and testing it is cheap. The real risk in this app is collaboration: RLS
policies, realtime reconciliation, the offline queue and the catalogue sync.
Those are integration tests, run against pglite.

- **Integration (bulk)** — RLS tested adversarially (household A cannot reach
  household B, across every table); feature use cases against a real database;
  catalogue sync idempotency; offline queue convergence.
- **Unit (pure logic only)** — the derivation and its unit conversion: scaling,
  dimension rules, leftovers contributing zero, staples filtering,
  running-low promotion, overrides, the incomplete-meal line, ISO week
  boundaries with an injected clock.
- **E2E (one flow)** — sign in, add a meal, backlog it, plan it, see the
  shopping list, copy the agent prompt.
- **Not unit-tested** — realtime sync and presence, which are verified with two
  real clients and airplane mode.

## Non-goals for v1

Recorded as decisions, not omissions:

- Ads and monetisation
- MCP server — dropped in favour of OS-level handoff
- Pantry inventory with quantities — staples flag only
- Nutrition, calories, macros
- Recipe URL or AI import — the public catalogue is the seeding strategy
- Cost tracking and budgeting
- Android App Actions, and the read-only web link
- **"Fill the week for me"** — the auto-layout button in the canvas's
  empty-week state. It ranks by cook frequency, which does not exist until a
  household has used the app for weeks, so it is dead weight for exactly the
  people who see that screen. Deferred to v2; drop the button from the design.
- Multi-household users

Nutrition and cost are called out because they are the two most likely requests
and the two most likely to derail what makes this app good: that planning a week
takes two minutes.

## Open questions

None blocking.

**Resolved by the visual design:** the public catalogue is sized at ~120
everyday meals ("120 everyday meals, copy any of them"), each with Finnish and
English names.

**Status: 30 Meals and 52 Ingredients written**, living as version-controlled
reference data in `data/catalogue/` and synced by `pnpm run catalogue:sync`. The
schema, the consistency check and the sync are done; the remaining ~90 Meals are
content work, scheduled rather than assumed. A test asserts the shipped
Catalogue is internally consistent and carries both Locales, so growing it
cannot quietly break it.

**Still open:**

- Whether household `slots` need per-day overrides (a weekend brunch slot), or
  whether one configuration per household is genuinely enough.
- **Dark mode.** The canvas defines only the light paper palette (#F7F2E9
  ground, #24211C ink, terracotta #C05A38 action, sage #5F7355 today/confirm,
  amber #E8B04B backlog). This app gets opened in a kitchen at 6am and at 10pm,
  so a dark direction is needed before the board is built — retrofitting one
  later costs more than deriving it now.
