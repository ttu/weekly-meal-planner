# 03 — Data Model

Names follow the glossary in `01-functional-spec.md`. Postgres columns are
`snake_case`, TypeScript is `camelCase`, and the mapping happens once, at the
infrastructure edge.

## Tables

| Table | Key columns | Notes |
|---|---|---|
| `household` | `id`, `name`, `slots jsonb` | `slots` is an ordered `[{key,label}]` |
| `household_member` | `household_id`, `user_id`, `role`, `display_name`, `avatar_url`, `colour` | display name and colour are load-bearing in the UI |
| `ingredient` | `id`, `household_id?`, `name`, `category`, `dimension`, `base_unit` | `household_id NULL` = global taxonomy |
| `meal` | `id`, `household_id?`, `name`, `description`, `servings`, `source_url?`, `photo_url?`, `copied_from_meal_id?` | `household_id NULL` = catalogue meal |
| `meal_ingredient` | `meal_id`, `ingredient_id`, `quantity`, `unit`, `optional` | may be empty for a name-only meal |
| `week_plan` | `id`, `household_id`, `week_start` | ISO week Monday |
| `backlog_item` | `id`, `week_plan_id`, `meal_id`, `added_by` | no date |
| `cook_event` | `id`, `week_plan_id`, `meal_id`, `date`, `slot_key`, `servings_cooked`, `from_backlog_item_id?` | the only ingredient contributor |
| `leftover` | `id`, `cook_event_id`, `date`, `slot_key` | `ON DELETE CASCADE` from the cook event |
| `household_staple` | `household_id`, `ingredient_id`, `running_low`, `marked_low_at?` | presence means "we normally have this" |
| `shopping_check` | `week_plan_id`, `ingredient_id`, `checked_at` | ticked in the shop |
| `shopping_override` | `week_plan_id`, `ingredient_id`, `quantity`, `unit`, `reason?` | manual quantity |
| `shopping_extra` | `id`, `week_plan_id`, `label`, `checked_at?` | belongs to no meal |

The Shopping List itself has no table. It is derived on every render; storing it
would mean it going stale exactly when Thursday's dinner changes.

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
type HouseholdId   = Brand<string, 'HouseholdId'>
type MemberId      = Brand<string, 'MemberId'>
type MealId        = Brand<string, 'MealId'>
type IngredientId  = Brand<string, 'IngredientId'>
type CookEventId   = Brand<string, 'CookEventId'>
type WeekPlanId    = Brand<string, 'WeekPlanId'>
type SlotKey       = Brand<string, 'SlotKey'>
type Servings      = Brand<number, 'Servings'>
type Quantity      = Brand<number, 'Quantity'>
type WeekStart     = Brand<string, 'WeekStart'>   // ISO date, always a Monday
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
- The catalogue and taxonomy files in `data/` — at load, in the sync script and in tests
- Local storage and the offline write queue — it survives app upgrades
- The App Group JSON snapshot, when App Intents land

Inside those boundaries the types are trusted and nothing re-validates.

## Nullability

`undefined` in TypeScript, `NULL` in Postgres, converted once at the
infrastructure edge. Domain types never carry `null`.
