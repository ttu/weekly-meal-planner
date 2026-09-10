-- Per-week Shopping List state. The list itself is never stored: it is derived
-- on every render (ADR 0003), because a stored list goes stale exactly when
-- someone changes Thursday's dinner.

-- Presence means "we normally have this": kept off the Buy list, surfaced in
-- the Cupboard Check instead. running_low pushes it back onto the Buy list.
create table household_staple (
  household_id uuid not null references household(id) on delete cascade,
  ingredient_id uuid not null references ingredient(id) on delete cascade,
  running_low boolean not null default false,
  marked_low_at timestamptz,
  primary key (household_id, ingredient_id)
);

create table shopping_check (
  week_plan_id uuid not null references week_plan(id) on delete cascade,
  ingredient_id uuid not null references ingredient(id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (week_plan_id, ingredient_id)
);

create table shopping_override (
  week_plan_id uuid not null references week_plan(id) on delete cascade,
  ingredient_id uuid not null references ingredient(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  -- Shown under the quantity so nobody wonders why the arithmetic looks wrong.
  reason text,
  primary key (week_plan_id, ingredient_id)
);

create table shopping_extra (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references week_plan(id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table shopping_check enable row level security;
alter table shopping_override enable row level security;
alter table shopping_extra enable row level security;
alter table household_staple enable row level security;

create policy shopping_check_all on shopping_check
  for all using (
    exists (
      select 1 from week_plan w
      where w.id = shopping_check.week_plan_id and app.is_member(w.household_id)
    )
  )
  with check (
    exists (
      select 1 from week_plan w
      where w.id = shopping_check.week_plan_id and app.is_member(w.household_id)
    )
  );

create policy shopping_override_all on shopping_override
  for all using (
    exists (
      select 1 from week_plan w
      where w.id = shopping_override.week_plan_id and app.is_member(w.household_id)
    )
  )
  with check (
    exists (
      select 1 from week_plan w
      where w.id = shopping_override.week_plan_id and app.is_member(w.household_id)
    )
  );

create policy shopping_extra_all on shopping_extra
  for all using (
    exists (
      select 1 from week_plan w
      where w.id = shopping_extra.week_plan_id and app.is_member(w.household_id)
    )
  )
  with check (
    exists (
      select 1 from week_plan w
      where w.id = shopping_extra.week_plan_id and app.is_member(w.household_id)
    )
  );

create policy household_staple_all on household_staple
  for all using (app.is_member(household_id)) with check (app.is_member(household_id));
