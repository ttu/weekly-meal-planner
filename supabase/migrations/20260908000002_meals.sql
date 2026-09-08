create table ingredient (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references household(id) on delete cascade,
  slug text not null,
  category text not null,
  dimension text not null check (dimension in ('mass', 'volume', 'count')),
  base_unit text not null,
  unique (household_id, slug)
);

-- Identity is the slug, never a name: a Finnish Household's "sipuli" and an
-- English Catalogue Meal's "onion" must aggregate to one Buy Line (ADR 0009).
create table ingredient_name (
  ingredient_id uuid not null references ingredient(id) on delete cascade,
  locale text not null check (locale in ('fi', 'en')),
  name text not null,
  primary key (ingredient_id, locale)
);

create table meal (
  id uuid primary key default gen_random_uuid(),
  -- NULL means Catalogue Meal: readable by all, editable by none through the
  -- client.
  household_id uuid references household(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  servings integer not null default 4 check (servings between 1 and 50),
  source_url text,
  photo_url text,
  copied_from_meal_id uuid references meal(id) on delete set null,
  created_at timestamptz not null default now()
);

create index meal_household_idx on meal (household_id);

-- A Meal with no rows here is legal: the day-one quick-add path creates exactly
-- that, and the Shopping List surfaces it as an incomplete-Meal line rather
-- than silently omitting it.
create table meal_ingredient (
  meal_id uuid not null references meal(id) on delete cascade,
  ingredient_id uuid not null references ingredient(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  optional boolean not null default false,
  primary key (meal_id, ingredient_id)
);
alter table ingredient enable row level security;
alter table ingredient_name enable row level security;
alter table meal enable row level security;
alter table meal_ingredient enable row level security;

create policy ingredient_select on ingredient
  for select using (household_id is null or app.is_member(household_id));

create policy ingredient_write on ingredient
  for all using (household_id is not null and app.is_member(household_id))
  with check (household_id is not null and app.is_member(household_id));

create policy ingredient_name_select on ingredient_name
  for select using (
    exists (
      select 1 from ingredient i
      where i.id = ingredient_name.ingredient_id
        and (i.household_id is null or app.is_member(i.household_id))
    )
  );

create policy meal_select on meal
  for select using (household_id is null or app.is_member(household_id));

create policy meal_write on meal
  for all using (household_id is not null and app.is_member(household_id))
  with check (household_id is not null and app.is_member(household_id));

create policy meal_ingredient_select on meal_ingredient
  for select using (
    exists (
      select 1 from meal m
      where m.id = meal_ingredient.meal_id
        and (m.household_id is null or app.is_member(m.household_id))
    )
  );

create policy meal_ingredient_write on meal_ingredient
  for all using (
    exists (
      select 1 from meal m
      where m.id = meal_ingredient.meal_id
        and m.household_id is not null and app.is_member(m.household_id)
    )
  )
  with check (
    exists (
      select 1 from meal m
      where m.id = meal_ingredient.meal_id
        and m.household_id is not null and app.is_member(m.household_id)
    )
  );
