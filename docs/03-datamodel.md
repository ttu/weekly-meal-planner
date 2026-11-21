# 03 — Data model

There is no database of ours. A Household's data is a set of **rows** that live
on its Members' devices and merge by last-writer-wins per field (ADR 0013,
[11-sync](11-sync.md)). A row is an entity named `<kind>:<id>`; each field is
written, and merged, on its own. A removed row has `deleted: true` and comes back
if it is written to again.

Rows are plain JSON (no `null`: absence is `undefined`), read defensively. Another
Member's device may write nonsense, so every reader parses with a schema and
leaves out a row that does not fit, and a field that does not fit falls back to
its default.

## Rows

| Kind        | Id                                       | Fields                                                                                          |
| ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `household` | `main`                                   | `name`, `locale` (`fi`/`en`), `size`, `slots` (ordered list)                                    |
| `member`    | the Member's signing key                 | `name`, `colour` — how they are shown; access is the membership log                             |
| `meal`      | random                                   | `name`, `servings`, `ingredients[]` (`ingredientId`, `quantity`, `unit`)                        |
| `backlog`   | random, or the unplanned Cook Event's id | `week`, `mealId`, `addedBy`, `createdAt`                                                        |
| `cook`      | the Backlog Item's id, or random         | `place` (`week`, `date`, `slot` as one field), `mealId`, `servings`, `addedBy?`, `fromBacklog?` |
| `leftover`  | random                                   | `cook`, `date`, `slot`                                                                          |
| `check`     | `<week>:<ingredient>`                    | `week`, `ingredientId`, `checked`                                                               |
| `staple`    | the Ingredient id                        | `ingredientId`, `runningLow`                                                                    |
| `extra`     | random                                   | `week`, `label`, `checked`, `createdAt`                                                         |
| `override`  | `<week>:<ingredient>`                    | `week`, `ingredientId`, `quantity`, `unit`, `reason?`                                           |

`week` is the Monday of the ISO week (`2026-03-09`). There is no Week Plan row:
nothing has to exist before the first Meal is put in a week.

## What is not a row

- **Membership** (who is on the board, who is an admin) is the signed,
  hash-chained operation log, not a row. See [11-sync](11-sync.md) and
  [06-security](06-security.md).
- **The Catalogue** is shipped data: `data/catalogue/ingredients.json` and
  `meals.json`, validated by `scripts/catalogue-schema.ts`. An Ingredient's
  identity is its **Slug**, and its id _is_ the slug; a Catalogue Meal's id is
  derived from its English name (`catalogue-chili-con-carne`). Adding a Catalogue
  Meal copies it into a `meal` row (ADR 0005).
- **The Shopping List** is derived on every read and never stored (ADR 0003).
- **Photos** are not supported yet: they need encrypted blob storage (TODO.md).

## Rules that used to be constraints

The database enforced these; the client now does, where the write is made:

- A Meal needs a name (at most 120 characters) and no repeated Ingredient.
- An Ingredient must be a Catalogue one, and a unit must belong to its
  Dimension (`g`/`kg` for mass, `ml`/`dl`/`l` for volume, `pcs`/`tin`/`pack`/`bunch`
  for count).
- A week holds at most 100 Backlog Items and 100 Cook Events; a Cook Event at most
  20 Leftovers; a week at most 100 Extras. The caps are per device view: two
  offline devices can together exceed them.
- A Catalogue Meal is never edited.
- Planning a Backlog Item gives the Cook Event the Item's own id, so two Members
  planning it at once converge on one Cook Event. Unplanning brings the Item back
  under that id, with its author.
- Rows hanging off a Meal that is gone (planned Cook Events, Backlog Items) are
  hidden, and so are Leftovers whose Cook Event is gone.

## Ids and types

Domain identifiers are branded types (`HouseholdId`, `MemberId`, `MealId`,
`IngredientId`, `IngredientSlug`, `CookEventId`, `LeftoverId`, `BacklogItemId`,
`WeekStart`, `SlotKey`) in `src/shared/types/ids.ts`. A **Member** is identified
by their Ed25519 signing public key; a **Household** by
`sha256('menami/v1/household', adminKey, nonce)`.
