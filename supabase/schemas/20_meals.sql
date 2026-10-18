create table ingredient (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references household(id) on delete cascade,
  slug text not null check (length(slug) between 1 and 80),
  category text not null check (length(category) <= 40),
  dimension text not null check (dimension in ('mass', 'volume', 'count')),
  base_unit text not null check (length(base_unit) <= 20),
  unique (household_id, slug)
);

-- Identity is the slug, never a name: a Finnish Household's "sipuli" and an
-- English Catalogue Meal's "onion" must aggregate to one Buy Line (ADR 0009).
create table ingredient_name (
  ingredient_id uuid not null references ingredient(id) on delete cascade,
  locale text not null check (locale in ('fi', 'en')),
  name text not null check (length(name) between 1 and 80),
  primary key (ingredient_id, locale)
);

create table meal (
  id uuid primary key default gen_random_uuid(),
  -- NULL means Catalogue Meal: readable by all, editable by none through the
  -- client.
  household_id uuid references household(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text check (length(description) <= 2000),
  servings integer not null default 4 check (servings between 1 and 50),
  source_url text check (length(source_url) <= 2048),
  photo_url text check (length(photo_url) <= 2048),
  copied_from_meal_id uuid references meal(id) on delete set null,
  created_at timestamptz not null default now()
);

create index meal_household_idx on meal (household_id);
create index meal_copied_from_idx on meal (copied_from_meal_id) where copied_from_meal_id is not null;

-- A Meal with no rows here is legal: the day-one quick-add path creates exactly
-- that, and the Shopping List surfaces it as an incomplete-Meal line rather
-- than silently omitting it.
create table meal_ingredient (
  meal_id uuid not null references meal(id) on delete cascade,
  ingredient_id uuid not null references ingredient(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null check (length(unit) <= 20),
  optional boolean not null default false,
  primary key (meal_id, ingredient_id)
);

-- The primary key serves lookups by Meal; deleting an Ingredient checks this
-- column, and without an index of its own that is a scan of every Meal's rows.
create index meal_ingredient_ingredient_idx on meal_ingredient (ingredient_id);
