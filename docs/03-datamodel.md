# 03 — Data Model

Names follow the glossary in `01-functional-spec.md`. Postgres columns are
`snake_case`, TypeScript is `camelCase`, and the mapping happens once, at the
infrastructure edge.

## Tables

| Table               | Key columns                                                                                                              | Notes                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `household`         | `id`, `name`, `slots jsonb`, `locale`                                                                                    | `slots` is an ordered `[{key,labelKey,label?}]`; `locale` is `fi` or `en`                                                                    |
| `household_member`  | `household_id`, `user_id`, `role`, `display_name`, `avatar_url`, `colour`                                                | display name and colour are load-bearing in the UI                                                                                           |
| `ingredient`        | `id`, `household_id?`, `slug`, `category`, `dimension`, `base_unit`                                                      | identity is the locale-independent `slug`; `household_id NULL` = global taxonomy                                                             |
| `ingredient_name`   | `ingredient_id`, `locale`, `name`                                                                                        | one row per locale; global ingredients carry `fi` and `en`                                                                                   |
| `meal`              | `id`, `household_id?`, `locale?`, `name`, `description`, `servings`, `source_url?`, `photo_url?`, `copied_from_meal_id?` | `household_id NULL` = catalogue meal, and then `locale` is set; `photo_url` is a path in the private `meal-photo` bucket, or an absolute URL |
| `meal_ingredient`   | `meal_id`, `ingredient_id`, `quantity`, `unit`, `optional`                                                               | may be empty for a name-only meal                                                                                                            |
| `week_plan`         | `id`, `household_id`, `week_start`                                                                                       | ISO week Monday                                                                                                                              |
| `backlog_item`      | `id`, `week_plan_id`, `meal_id`, `added_by`                                                                              | no date                                                                                                                                      |
| `cook_event`        | `id`, `week_plan_id`, `meal_id`, `date`, `slot_key`, `servings_cooked`, `added_by`, `from_backlog_item_id?`              | the only ingredient contributor                                                                                                              |
| `leftover`          | `id`, `cook_event_id`, `date`, `slot_key`                                                                                | `ON DELETE CASCADE` from the cook event                                                                                                      |
| `household_staple`  | `household_id`, `ingredient_id`, `running_low`, `marked_low_at?`                                                         | presence means "we normally have this"                                                                                                       |
| `shopping_check`    | `week_plan_id`, `ingredient_id`, `checked_at`                                                                            | ticked in the shop                                                                                                                           |
| `shopping_override` | `week_plan_id`, `ingredient_id`, `quantity`, `unit`, `reason?`                                                           | manual quantity                                                                                                                              |
| `shopping_extra`    | `id`, `week_plan_id`, `label`, `checked_at?`                                                                             | belongs to no meal                                                                                                                           |

The Shopping List itself has no table. It is derived on every render; storing it
would mean it going stale exactly when Thursday's dinner changes.

## Localisation and identity

The app ships in Finnish and English (ADR 0009), and that has one structural
consequence: **an Ingredient's identity cannot be its name.** If a Finnish
household plans a meal naming `sipuli` and an English catalogue meal names
`onion`, the Shopping List must produce one Buy Line of five onions, not two
lines of two and three.

So `ingredient` is keyed on a locale-independent `slug`, and display names live
in `ingredient_name`, one row per locale. Aggregation joins on `ingredient_id`
and never touches a name. A household-created ingredient gets a single
`ingredient_name` row in the household's locale; if the app is later viewed in
the other locale it falls back to whatever row exists, which is correct — the
family called it that.

Meals are different and deliberately simpler. Catalogue meals carry per-locale
names and descriptions **in the reference data files**, not in the database:
the sync script writes one `meal` row per locale, with that locale's name, and
stamps `meal.locale` on it. The Household reads the Catalogue filtered to its
own Locale — without that column nothing recorded which language a row was in,
and the library listed every Catalogue Meal twice, once in each. A **Household
Meal has a single name**, in whatever language the family typed, and its
`locale` is NULL because it is never filtered. A family's own meal is
theirs and they name it once; forcing them to supply two names would be exactly
the kind of friction this app is supposed to avoid.

Units and category labels are translated in the UI layer from their stable keys,
never stored as display text.

## Constraints that carry meaning

- `meal_ingredient.unit` must be convertible within `ingredient.dimension`.
  Enforced by a check constraint calling an immutable function, not by
  application code, because the catalogue sync script writes here too.
- `cook_event.slot_key` must exist in its household's `slots`. Deliberately
  **not** a foreign key — slots are configuration, and removing a slot must not
  delete the meals planned in it. Validated on write, repaired in the UI.
- No uniqueness on `(date, slot_key)`. Two meals on Tuesday dinner is a
  supported outcome, not a conflict.
- `leftover` has no `meal_id` and no servings. It borrows both from its parent.

## Branded types

Every identifier and every quantity is branded, so arguments cannot be swapped:

```ts
type HouseholdId = Brand<string, 'HouseholdId'>
type MemberId = Brand<string, 'MemberId'>
type MealId = Brand<string, 'MealId'>
type IngredientId = Brand<string, 'IngredientId'>
type CookEventId = Brand<string, 'CookEventId'>
type WeekPlanId = Brand<string, 'WeekPlanId'>
type SlotKey = Brand<string, 'SlotKey'>
type Servings = Brand<number, 'Servings'>
type Quantity = Brand<number, 'Quantity'>
type WeekStart = Brand<string, 'WeekStart'> // ISO date, always a Monday
```

Quantities are branded for the same reason ids are. `scale(quantity, servings)`
taking two bare `number`s is the bug that puts four kilos of onions on a list,
and it is a bug the type system can simply refuse.

Branded values are constructed only by parsers at the edge, never by casting.

## Validation at the edge

Every external boundary is schema-validated (Zod), and the static types are
derived from the schemas rather than declared alongside them:

- PostgREST responses — the database can be ahead of or behind the client
- Environment variables — at startup, failing loudly
- The catalogue and taxonomy files in `data/` — at load, in the sync script and
  in tests, including a check that every entry has both `fi` and `en` names
- Local storage and the offline write queue — it survives app upgrades
- The App Group JSON snapshot, when App Intents land

Inside those boundaries the types are trusted and nothing re-validates.

## Nullability

`undefined` in TypeScript, `NULL` in Postgres, converted once at the
infrastructure edge. Domain types never carry `null`.
