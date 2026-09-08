# Design Handoff — Weekly Meal Planner

Paste this whole file to Claude Design. It is self-contained; no prior
conversation is needed.

---

## What the product is

A shared weekly meal board for a household. Anyone in the family adds meals they
fancy to a **weekly backlog**; someone then places those meals onto specific
**days and slots**. The planned week produces a **shopping list**, which can be
copied as a prompt for a browser AI agent, shared, or pushed to Apple Reminders.

Built with Expo (React Native) for iOS and Android, with a web target. So: real
phone app first, wide-screen layout second.

**The constraint that outranks everything:** planning a week takes two minutes.
The design should feel fast and low-stakes, not like data entry.

## Who uses it

A household of two to five people, plus single people living alone. Mixed
technical confidence — a parent adding meals on a phone in a supermarket queue,
another filling in the week at a laptop on Sunday evening, a teenager throwing
"tacos" into the backlog. It gets opened four or five times a week for a minute
or two, often one-handed in a kitchen.

## Tone

Warm, domestic, quietly competent. This is a household object, not a
productivity tool — closer to a fridge whiteboard than to a project tracker.
Avoid the grid-of-cards SaaS dashboard look, and avoid the over-styled
food-magazine look where photography drowns the function. Food photography
appears, but small and optional: most meals will have no photo, and the design
must look intentional when nothing has an image.

Prefer legible-at-arm's-length type; this gets read from across a kitchen.

## Screens to design

### 1. The week board — phone

The primary screen. Vertical list of days; each day shows the household's
configured slots (default: lunch and dinner, but a household can add or remove
slots, so the number of rows per day is not fixed). A week strip at the top for
jumping between days. A backlog shelf, always reachable.

Needs to handle: a day with nothing planned, a day with one meal, a slot with
two meals in it (this is allowed and normal — two people can both drop
something on Tuesday dinner), and a slot holding a leftover card.

### 2. The week board — wide screen (tablet, desktop web)

Three panes in one view:

| Pane   | Content                                                                  |
| ------ | ------------------------------------------------------------------------ |
| Left   | Meal library — household's own meals plus a public catalogue, searchable |
| Centre | This week's backlog                                                      |
| Right  | The board, all seven days with their slots                               |

Meals drag left-to-right: library → backlog, or library → board directly. This
collapses to the phone layout at around 1024px.

### 3. Meal cards

Three variants of the same object, which must be instantly distinguishable at a
glance:

- **Library card** — a meal available to plan. Name, servings, optional photo.
- **Backlog card** — wanted this week, not yet dated. Shows **who added it**;
  this social signal matters, it is how a family sees "dad wants curry".
- **Planned card** — sitting in a day slot. Shows servings cooked.
- **Leftover card** — a lighter, visibly secondary variant naming its parent
  ("Chili — leftovers"). It must read as _derived from_ another card, not as a
  meal in its own right. This distinction is the one people will get wrong if
  the design does not carry it.

### 4. Shopping list

Three sections, in this order:

1. **Buy** — items to purchase, grouped by category (produce, dairy, dry goods)
   so the list follows the shop's layout, not the recipes. Quantities are
   aggregated across meals.
2. **Check the cupboard** — household staples (spices, oil, flour) used by this
   week's meals. Not on the buy list, but each has a "we're out" action that
   moves it up into Buy. This section prevents the classic failure: discovering
   at the stove that the cumin is gone.
3. **Extras** — manually added non-meal items ("bin bags").

Behaviours to design for: ticking items off while actually shopping (one-handed,
possibly with a trolley), expanding a line to see which meals contributed to it
("why four onions?"), and a line whose quantity has been manually overridden.

Also: a **"copy as agent prompt"** action, which is a primary action on this
screen, not a buried menu item.

### 5. Meal library and picker

Household's own meals and a curated public catalogue in one searchable list, own
meals first, catalogue ones badged. Adding a catalogue meal copies it into the
household's library, where it becomes editable — the design should make that
copy-not-link behaviour feel obvious rather than surprising.

### 6. Meal editor

Name, servings, optional photo, and a list of ingredients with quantity and
unit. Ingredient rows are the fiddly part and deserve the most attention: this
is the only genuinely data-entry-shaped screen in the app, and it is where
people will give up if it is tedious.

### 7. Household staples

The list of "we always have this" ingredients, with a running-low toggle per
item. Low-frequency screen; keep it plain.

## States that must be designed, not left to chance

- **Empty household, day one** — no meals in the library, empty board. This is
  everyone's first impression and it is currently the weakest moment in the
  product. Needs to make the first meal easy to create or copy from the
  catalogue.
- **Empty week** — library has meals, nothing planned yet.
- **Meals with no photo** — the common case.
- **A slot with two meals in it** — allowed, not an error.
- **Offline** — kitchens have bad wifi. Reads work, writes queue. Needs a quiet,
  non-alarming indicator.
- **Someone else is editing** — changes arrive live from other household
  members. Should feel like presence, not like the screen jumping.
- **Long meal names and long ingredient names** — Finnish compound words get
  very long. Do not design around short English strings.

## Interaction notes

- Every drag must have a tap equivalent. Dragging across a seven-day board on a
  phone is awkward; drag is the accelerator on wide screens, never the only
  path. Tapping a backlog card should offer "Plan for…" with a day and slot
  picker.
- The shopping list is used in a shop, at arm's length, one-handed, often with
  gloves in winter. Tap targets there should be generous.
- Nothing in the app should ever block a household member's edit. Two cards on
  Tuesday is a better outcome than a rejection.

## Out of scope — do not design these

Nutrition or calories, cost and budgeting, pantry inventory with quantities,
recipe import from URLs, ads, and any onboarding flow longer than one screen.

## What I want back

Layouts and visual direction for screens 1–4 (the board on phone, the board on
wide screen, the meal card variants, and the shopping list), plus the empty
states. Screens 5–7 can follow the system those establish.

A colour and type direction that survives both a photo-rich library and a
photo-free one, and that works in dark mode — this app gets opened in a kitchen
at 6am and at 10pm.

---

## Round 2 — feedback on the delivered design

The direction (Claude Design project _Meal Planner_, file
`Meal Planner - Design Direction.dc.html`) is accepted. Two changes before it is
final:

1. **Remove "Fill the week for me"** from the empty-week state. It ranks meals
   by cook frequency, which does not exist until a household has used the app
   for weeks — so it is dead weight for exactly the people who see that screen.
   Deferred to v2. The empty week keeps the 55% day skeleton and the backlog
   shelf.
2. **Add a dark direction.** The canvas defines only the light paper palette.
   This app gets opened in a kitchen at 6am and at 10pm. Needed: dark
   equivalents for paper/ink/card/tint, and a check that terracotta (action),
   sage (today) and amber (backlog) stay distinguishable — amber on a dark
   ground is the one most likely to break, and it is the colour carrying "wanted
   but unplanned".

Everything else in the canvas is now reflected in the functional spec, including
the member colours and initials, presence ("Aino is editing Thursday"), the
one-line reason under an overridden quantity, the 19px/28px/54px shopping-list
row ergonomics, and meals created from a name with no ingredients yet.
