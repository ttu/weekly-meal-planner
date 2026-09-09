# Meal Library and Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Household can build its own Meal library — create Meals, give them
Ingredients, edit them, and copy Catalogue Meals in — so the Shopping List in
plan 04 has real data to derive from.

**Architecture:** Continues plans 01–02. The Meal editor is the only genuinely
data-entry-shaped screen in the app and gets the most attention; everything else
follows established patterns. Ingredient identity stays the locale-independent
slug (ADR 0009), so the editor picks Ingredients rather than typing names.

**Tech Stack:** As before.

**Spec:** `docs/01-functional-spec.md`, `docs/03-datamodel.md`,
`docs/07-design-system.md`, ADRs 0005 and 0009.

## What each task delivers

| Task | Openable and checkable                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1    | **A Meal library screen**, reachable from the board, listing your Meals and the Catalogue.                                   |
| 2    | **Create a Meal from a name alone** — the day-one path. It appears in the library and can be planned immediately.            |
| 3    | **Ingredient rows** — add, change quantity and unit, remove. This is the screen people give up on if it is tedious.          |
| 4    | **Edit an existing Meal** — rename, change servings, change Ingredients.                                                     |
| 5    | **Copy a Catalogue Meal** into the Household library, Ingredients included, and edit the copy without touching the original. |
| 6    | **Delete a Meal**, with the planned-Meals consequence stated rather than discovered.                                         |

## Global Constraints

Everything from plans 01–02 still applies. New for this plan:

- **A Meal with no Ingredients stays legal.** Task 2 exists because of it.
- **Ingredient identity is the slug.** The editor never lets a Member type a
  free-text Ingredient name that becomes a new Ingredient by accident — that is
  how `sipuli` and `onion` become two Buy Lines (ADR 0009).
- **Copying is a copy.** After copying, editing the Household's Meal must not
  change the Catalogue Meal, and a test must prove it.
- **Every editor field needs a `testID` and an accessibility label.**
- Work on `feat/03-meals`.

---

### Task 1: The Meal library screen

**Deliverable:** a screen listing the Household's Meals and the Catalogue,
reachable from the board.

**Files:**

- Create: `src/features/meals/ui/MealLibraryScreen.tsx`, `src/app/meals.tsx`
- Modify: `src/features/planning/ui/BoardScreen.tsx`, `src/features/meals/index.ts`
- Test: `src/features/meals/ui/MealLibraryScreen.test.tsx`

**Interfaces:**

- Consumes: `useHouseholdMeals`, `matchesSearch`, `MealCard` (plan 02)
- Produces: `<MealLibraryScreen />` and a `/meals` route

- [ ] **Step 1: Write the failing test**

Covers: own Meals and Catalogue Meals under their headings; search filters;
tapping a Meal reports it; an empty library shows a written state naming the
next action rather than a blank list.

- [ ] **Step 2: Implement the screen**

Reuse the picker's shape — search field, "Ours" then "Catalogue" — but as a
route rather than a modal, with an "Add a Meal" primary action. Each row shows
servings and Ingredient count, because "Tacos · no Ingredients yet" is the
signal a Member needs before planning it.

- [ ] **Step 3: Route from the board**

Add a library affordance to the board header. Expo Router: `src/app/meals.tsx`
renders the screen; the header pushes to it.

- [ ] **Step 4: Run it and look at it**

- [ ] **Step 5: Validate and commit**

---

### Task 2: Create a Meal from a name

**Deliverable:** the day-one path. Name a Meal, save, and plan it immediately —
Ingredients later.

**Files:**

- Create: `src/features/meals/application/save-meal.ts`,
  `src/features/meals/ui/MealEditorScreen.tsx`,
  `src/features/meals/ui/useSaveMeal.ts`, `src/app/meals/new.tsx`
- Test: `src/features/meals/ui/MealEditorScreen.test.tsx`,
  `src/test/db/meal-write.test.ts`

**Interfaces:**

- Produces:
  - `saveMeal(client, input): Promise<Result<MealId, SaveMealError>>` where
    `input = { id?: MealId; householdId: HouseholdId; name: string; servings: Servings; ingredients: readonly MealIngredientDraft[] }`
  - `type MealIngredientDraft = { ingredientId: IngredientId; quantity: Quantity; unit: string; optional: boolean }`

- [ ] **Step 1: Integration test for the write**

A Member can insert a Meal into their own Household and cannot into another's.
A Meal with an empty Ingredient list saves and reads back with zero rows.

- [ ] **Step 2: Editor with name and servings only**

Name field, servings stepper, Save. Validation is a domain function returning a
`Result`, not a thrown error: an empty name is an expected outcome.

Locale keys, both languages:

```
meal.new              New Meal                 Uusi ateria
meal.name             Name                     Nimi
meal.servings         Serves                   Annoksia
meal.save             Save                     Tallenna
meal.nameRequired     Give the Meal a name.    Anna aterialle nimi.
meal.saveFailed       Could not save. Try again.
                      Tallennus epäonnistui. Yritä uudelleen.
meal.noIngredients    No Ingredients yet       Ei vielä raaka-aineita
meal.ingredientCount_one    {{count}} Ingredient      {{count}} raaka-aine
meal.ingredientCount_other  {{count}} Ingredients     {{count}} raaka-ainetta
```

- [ ] **Step 3: Run it and use it**

Create "Pizza" with no Ingredients, then plan it onto Friday. Both must work —
that is the whole point of the day-one path.

- [ ] **Step 4: Validate and commit**

---

### Task 3: Ingredient rows

**Deliverable:** add Ingredients to a Meal, change quantity and unit, remove
one. The fiddly screen, done properly.

**Files:**

- Create: `src/features/meals/ui/IngredientRow.tsx`,
  `src/features/meals/ui/IngredientPicker.tsx`,
  `src/features/meals/infrastructure/ingredient-repository.ts`,
  `src/features/meals/domain/units.ts`
- Test: `src/features/meals/domain/units.test.ts`,
  `src/features/meals/ui/IngredientRow.test.tsx`

**Interfaces:**

- Produces:
  - `loadIngredients(client, locale): Promise<Result<readonly Ingredient[], LoadIngredientsError>>`
    where `Ingredient = { id; slug; name; category; dimension; baseUnit }` — the
    name already resolved for the Locale
  - `unitsFor(dimension): readonly string[]`
  - `<IngredientRow ingredient quantity unit onChange onRemove />`

- [ ] **Step 1: The unit domain**

`unitsFor('mass') === ['g', 'kg']`, `'volume' === ['ml', 'dl', 'l']`,
`'count' === ['pcs', 'tin', 'pack', 'bunch']`. Tested, because the Shopping
List's conversion in plan 04 depends on a unit belonging to exactly one
dimension.

- [ ] **Step 2: Ingredient picker**

Searchable, showing the Locale's name, grouped by category. Picks an existing
Ingredient by id — it never creates one from typed text, because that is how
`sipuli` and `onion` become two Buy Lines.

Creating a genuinely new Household Ingredient is a deliberate, separate action
with its own slug field, not a side effect of typing.

- [ ] **Step 3: The row**

Ingredient name, quantity field, unit selector limited to that Ingredient's
dimension, and a remove control. Quantity accepts decimals with either separator
— a Finnish keyboard produces a comma, and rejecting it is the kind of thing
that makes people abandon the screen.

- [ ] **Step 4: Run it and use it**

Give "Pizza" four Ingredients, change one to kg, remove one, save, reopen.

- [ ] **Step 5: Validate and commit**

---

### Task 4: Edit an existing Meal

**Deliverable:** open a Meal from the library, change anything, save.

**Files:**

- Modify: `src/features/meals/ui/MealEditorScreen.tsx`,
  `src/features/meals/application/save-meal.ts`
- Create: `src/app/meals/[id].tsx`
- Test: extend `src/test/db/meal-write.test.ts`

- [ ] **Step 1: Integration test**

Saving an existing Meal replaces its Ingredient rows rather than accumulating
them, and a Member cannot edit another Household's Meal or a Catalogue Meal.

- [ ] **Step 2: Load, edit, save**

`saveMeal` upserts when `id` is present, deleting removed Ingredient rows in the
same operation. Two statements again, so an RPC as in plan 02.

- [ ] **Step 3: Run it and use it**

- [ ] **Step 4: Validate and commit**

---

### Task 5: Copy a Catalogue Meal

**Deliverable:** copy a Catalogue Meal into the Household library with its
Ingredients, then edit the copy and confirm the original is untouched.

**Files:**

- Create: `src/features/meals/application/copy-catalogue-meal.ts`
- Test: `src/test/db/catalogue-copy.test.ts`

- [ ] **Step 1: The test that matters**

Copy, edit the copy's name and Ingredients, then assert the Catalogue Meal is
byte-for-byte unchanged. ADR 0005 is only worth having if this holds.

Also assert `copied_from_meal_id` is set, since provenance is what makes a
future "the original changed" prompt possible.

- [ ] **Step 2: Copy as an RPC**

Meal row plus its `meal_ingredient` rows must arrive together.

- [ ] **Step 3: Wire it into the library and picker**

A Catalogue row's primary action copies rather than plans, and says so.

- [ ] **Step 4: Run it and use it**

- [ ] **Step 5: Validate and commit**

---

### Task 6: Delete a Meal

**Deliverable:** delete a Meal, with the consequence for planned weeks stated
before it happens.

**Files:**

- Create: `src/features/meals/application/delete-meal.ts`
- Test: extend `src/test/db/meal-write.test.ts`

- [ ] **Step 1: Decide and test the consequence**

`meal_id` on `cook_event` and `backlog_item` cascades, so deleting a Meal
removes it from planned weeks. That is a real consequence and the confirmation
must name it: how many Cook Events and Backlog Items will go.

Test: deleting a Meal used by a Cook Event removes that Cook Event and its
Leftovers.

Locale keys:

```
meal.delete                   Delete Meal            Poista ateria
meal.deleteConfirm            Delete "{{meal}}"?     Poistetaanko "{{meal}}"?
meal.deletePlanned_one        It is planned {{count}} time this week; that will go too.
                              Se on suunniteltu {{count}} kerran tällä viikolla, ja katoaa myös.
meal.deletePlanned_other      It is planned {{count}} times this week; those will go too.
                              Se on suunniteltu {{count}} kertaa tällä viikolla, ja ne katoavat myös.
```

- [ ] **Step 2: Confirm and delete**

Reuse `ConfirmSheet` from plan 02.

- [ ] **Step 3: Run it and use it**

- [ ] **Step 4: Validate and commit**

---

## Self-Review

**Spec coverage.** Household Meal library ✓ (1); Meals with no Ingredients ✓
(2); Ingredients with quantity and unit ✓ (3); editing ✓ (4); catalogue
copy-on-add with provenance ✓ (5); deletion ✓ (6); slug-keyed identity upheld
throughout ✓; both Locales ✓.

**Deferred.** Photos (no storage yet — plan 08 territory); recipe import (a
stated non-goal); the wide-screen three-pane library (plan 07).

**Known risk.** Task 3's Ingredient picker is where ADR 0009 can quietly break:
if it ever creates an Ingredient from typed text, duplicate slugs appear and the
Shopping List splits into wrong lines. The picker must only select existing
Ingredients; creating one is a separate, deliberate action.
