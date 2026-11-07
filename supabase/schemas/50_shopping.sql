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
  unit text not null check (length(unit) <= 20),
  -- Shown under the quantity so nobody wonders why the arithmetic looks wrong.
  reason text check (length(reason) <= 200),
  primary key (week_plan_id, ingredient_id)
);

create table shopping_extra (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references week_plan(id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- The database stamps these, never the phone: a phone with a wrong clock would
-- otherwise decide when a Staple ran low or an Extra was ticked. A client says
-- "low" or "checked" with any non-null value; the time it sends is discarded.
create or replace function app.stamp_marked_low_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.running_low then
    new.marked_low_at := case
      when tg_op = 'UPDATE' and old.running_low then old.marked_low_at
      else now()
    end;
  elsif tg_op = 'UPDATE' then
    new.marked_low_at := old.marked_low_at;
  else
    new.marked_low_at := null;
  end if;
  return new;
end;
$fn$;

create trigger household_staple_stamp before insert or update on household_staple
  for each row execute function app.stamp_marked_low_at();

create or replace function app.stamp_checked_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.checked_at is not null then
    new.checked_at := case
      when tg_op = 'UPDATE' and old.checked_at is not null then old.checked_at
      else now()
    end;
  end if;
  return new;
end;
$fn$;

create trigger shopping_extra_stamp before insert or update of checked_at on shopping_extra
  for each row execute function app.stamp_checked_at();
