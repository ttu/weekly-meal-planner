# Shopping List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The week's plan produces a Shopping List a family can actually shop
from, and hand to a browser AI agent.

**Architecture:** The derivation is a pure function over plain data
(ADR 0003) — the one place unit tests carry real weight. Everything stored is
per-week state: ticked items, Extras, quantity Overrides.

**Spec:** `docs/01-functional-spec.md` (Shopping List), `docs/07-design-system.md`,
ADRs 0003 and 0009.

## What each task delivers

| Task | Openable and checkable                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 1    | **Aggregation, tested.** No UI yet — the one unavoidably invisible task, and the one that must be right. |
| 2    | **A Shopping List screen** showing Buy, grouped by category, from the real planned week.                 |
| 3    | **Cupboard Check** — Staples surfaced separately, with "we're out" promoting one into Buy.               |
| 4    | **Ticking off, Extras and Overrides**, surviving a reload.                                               |
| 5    | **Provenance** — expand a line to see which Meals contributed.                                           |
| 6    | **Copy as agent prompt** and OS share.                                                                   |

## Global Constraints

Everything from plans 01–03. New:

- **The Shopping List is never stored.** It recomputes on render (ADR 0003).
- **Conversion happens only within a dimension.** Mixed dimensions stay as
  separate lines on one Ingredient; guessing a gram weight for a tablespoon is
  how a list quietly becomes wrong.
- **Leftovers contribute nothing.** They are already paid for by their Cook Event.
- **A planned Meal with no Ingredients gets its own line**, linking to the editor.
- Row ergonomics are requirements: 19px text, 28px checkbox, 54px minimum row
  height, whole row is the target.
- Work on `feat/04-shopping`.

---

### Task 1: The derivation

**Deliverable:** pure functions with thorough tests. Nothing to look at — said
plainly rather than dressed up.

**Files:**

- Create: `src/features/shopping/domain/{types,convert,derive}.ts`
- Test: `src/features/shopping/domain/{convert,derive}.test.ts`

**Interfaces:**

- `convert(quantity, from, to): Result<Quantity, ConvertError>`
- `deriveShoppingList(input): ShoppingList` where
  `input = { cookEvents, mealIngredients, ingredients, staples, overrides, extras, checks }`
- `ShoppingList = { buy: readonly BuyLine[]; cupboard: readonly CupboardLine[]; extras: readonly ExtraLine[]; incomplete: readonly IncompleteMealLine[] }`

- [ ] **Step 1: Conversion**

Within `mass`: g ↔ kg. Within `volume`: ml ↔ dl ↔ l. Within `count`: no
conversion between units — a tin is not a pack. Across dimensions: an error, not
a guess.

- [ ] **Step 2: Aggregation**

Scale by `servingsCooked / meal.servings`. Sum per Ingredient per unit-group.
Leftovers contribute nothing. Staples move to Cupboard Check unless
`running_low`. Overrides win. Meals with no Ingredients produce their own line.

- [ ] **Step 3: Validate and commit**

---

### Task 2: The Buy list on screen

**Files:** `src/features/shopping/{infrastructure,ui}`, `src/app/shopping.tsx`

- [ ] Load the week's Cook Events with their Meals' Ingredients, derive, render
      grouped by category, reachable from the board.
- [ ] Run it and look at it.
- [ ] Validate and commit.

---

### Task 3: Cupboard Check

- [ ] `household_staple` read and rendered on tint, visibly not the Buy list.
- [ ] "We're out" promotes into Buy and leaves a note behind it.
- [ ] Seed some Staples so there is something to see.

---

### Task 4: Ticking, Extras and Overrides

- [ ] Three small tables, RLS-tested like everything else.
- [ ] Ticked rows grey and strike but stay in place; the list never reflows
      under a moving thumb.

---

### Task 5: Provenance

- [ ] Expanding a Buy Line shows which Meals contributed and how much.

---

### Task 6: Agent prompt and share

- [ ] Copy-as-prompt built from the derived list, in the Household's Locale.
- [ ] It carries no names, no Household id and no URL — items and quantities
      only (docs/06-security.md).
- [ ] OS share of the same text.

---

## Self-Review

Covers the Shopping List section of the functional spec. Defers Apple Reminders
and App Intents (plan 08 territory: they need a native target and a development
build). The riskiest part is Task 1, which is why it is pure and first.
