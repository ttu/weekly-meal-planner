-- Limits on what one Household can write: length checks on every unbounded
-- text column, row caps per Household / Meal / Week Plan / Cook Event, and
-- photo uploads restricted to one name per Meal and extension. See
-- supabase/schemas/95_limits.sql for the reasoning; this migration brings a
-- database up to it. Constraint names match what the inline checks in the
-- schema files get by default.

alter table household
  add constraint household_slots_check check (length(slots::text) <= 4000);
alter table household_member
  add constraint household_member_avatar_url_check check (length(avatar_url) <= 2048),
  add constraint household_member_colour_check check (length(colour) <= 16);
alter table ingredient
  add constraint ingredient_slug_check check (length(slug) between 1 and 80),
  add constraint ingredient_category_check check (length(category) <= 40),
  add constraint ingredient_base_unit_check check (length(base_unit) <= 20);
alter table ingredient_name
  add constraint ingredient_name_name_check check (length(name) between 1 and 80);
alter table meal
  add constraint meal_description_check check (length(description) <= 2000),
  add constraint meal_source_url_check check (length(source_url) <= 2048),
  add constraint meal_photo_url_check check (length(photo_url) <= 2048);
alter table meal_ingredient
  add constraint meal_ingredient_unit_check check (length(unit) <= 20);
alter table cook_event
  add constraint cook_event_slot_key_check check (length(slot_key) <= 40);
alter table leftover
  add constraint leftover_slot_key_check check (length(slot_key) <= 40);
alter table shopping_override
  add constraint shopping_override_unit_check check (length(unit) <= 20),
  add constraint shopping_override_reason_check check (length(reason) <= 200);

create or replace function app.enforce_row_cap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  cap integer := tg_argv[0]::integer;
  -- The column a row is counted under, read by name from the row itself so
  -- no SQL is built from strings (06-security).
  scope uuid := (to_jsonb(new) ->> tg_argv[1])::uuid;
  existing integer;
begin
  -- An update that moves a row to another Household, Meal or Week Plan adds
  -- one there as surely as an insert does; without this, insert-then-move
  -- piles any number of rows under one scope. Any other update adds nothing.
  if tg_op = 'UPDATE' and scope is not distinct from (to_jsonb(old) ->> tg_argv[1])::uuid then
    return new;
  end if;

  -- Catalogue rows have no Household and are written only by the sync script.
  if scope is null then
    return new;
  end if;

  -- Without the lock, concurrent inserts each count the same total and all
  -- pass. Transaction-scoped, so it is released however the insert ends.
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || scope::text, 0));

  -- One branch per table, each with a static query.
  case tg_table_name
    when 'household_member' then
      select count(*) into existing from household_member where household_id = scope;
    when 'meal' then
      select count(*) into existing from meal where household_id = scope;
    when 'ingredient' then
      select count(*) into existing from ingredient where household_id = scope;
    when 'household_staple' then
      select count(*) into existing from household_staple where household_id = scope;
    when 'week_plan' then
      select count(*) into existing from week_plan where household_id = scope;
    when 'meal_ingredient' then
      select count(*) into existing from meal_ingredient where meal_id = scope;
    when 'backlog_item' then
      select count(*) into existing from backlog_item where week_plan_id = scope;
    when 'cook_event' then
      select count(*) into existing from cook_event where week_plan_id = scope;
    when 'shopping_extra' then
      select count(*) into existing from shopping_extra where week_plan_id = scope;
    when 'leftover' then
      select count(*) into existing from leftover where cook_event_id = scope;
  end case;

  if existing >= cap then
    -- 54000 is program_limit_exceeded: a client can tell "too many" from a
    -- policy refusal without parsing the message.
    raise exception 'Too many % rows (limit %)', tg_table_name, cap
      using errcode = '54000';
  end if;

  return new;
end;
$fn$;

-- Per Household.
create trigger household_member_cap before insert or update of household_id on household_member
  for each row execute function app.enforce_row_cap(20, 'household_id');
create trigger meal_cap before insert or update of household_id on meal
  for each row execute function app.enforce_row_cap(500, 'household_id');
create trigger ingredient_cap before insert or update of household_id on ingredient
  for each row execute function app.enforce_row_cap(500, 'household_id');
create trigger household_staple_cap before insert or update of household_id on household_staple
  for each row execute function app.enforce_row_cap(500, 'household_id');
-- Twenty years of weeks.
create trigger week_plan_cap before insert or update of household_id on week_plan
  for each row execute function app.enforce_row_cap(1040, 'household_id');

-- Per Meal.
create trigger meal_ingredient_cap before insert or update of meal_id on meal_ingredient
  for each row execute function app.enforce_row_cap(60, 'meal_id');

-- Per Week Plan.
create trigger backlog_item_cap before insert or update of week_plan_id on backlog_item
  for each row execute function app.enforce_row_cap(100, 'week_plan_id');
create trigger cook_event_cap before insert or update of week_plan_id on cook_event
  for each row execute function app.enforce_row_cap(100, 'week_plan_id');
create trigger shopping_extra_cap before insert or update of week_plan_id on shopping_extra
  for each row execute function app.enforce_row_cap(100, 'week_plan_id');

-- Per Cook Event.
create trigger leftover_cap before insert or update of cook_event_id on leftover
  for each row execute function app.enforce_row_cap(20, 'cook_event_id');

drop policy meal_photo_insert on storage.objects;
drop policy meal_photo_update on storage.objects;

-- Writing is narrower than reading: the name must be exactly
-- `<household_id>/<meal_id>.<ext>` for a Meal that exists on the board. Any
-- other name would let a Member upload files without end, each under the size
-- limit; this way a Meal holds at most one per extension.
--
-- That alone does not bound a board: delete the Meal without deleting its
-- photo (the app does, a hostile client need not), make another, repeat. The
-- orphan cannot be removed from SQL — Storage refuses direct deletes, and the
-- file would outlive the row anyway — so the count of a Household's objects is
-- capped here instead. Orphans count against it until removed through the
-- Storage API, which the household-wide delete policy still allows.
create or replace function app.names_own_meal_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic)$'
    and exists (
      select 1
      from household_member hm
      join meal m on m.household_id = hm.household_id
      where hm.user_id = auth.uid()
        and hm.household_id::text = split_part(object_name, '/', 1)
        and m.id::text = split_part(split_part(object_name, '/', 2), '.', 1)
    )
    and (
      select count(*)
      from storage.objects o
      where o.bucket_id = 'meal-photo'
        and o.name like split_part(object_name, '/', 1) || '/%'
    ) < 500;
$fn$;

create policy meal_photo_insert on storage.objects
  for insert with check (bucket_id = 'meal-photo' and app.names_own_meal_photo(name));

create policy meal_photo_update on storage.objects
  for update using (bucket_id = 'meal-photo' and app.owns_meal_photo(name))
  with check (bucket_id = 'meal-photo' and app.names_own_meal_photo(name));

