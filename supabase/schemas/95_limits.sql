-- Limits on what one Household can write.
--
-- Auth, starting a board and joining one were already throttled (06-security).
-- Past that, a Member could insert rows in a loop until the database filled:
-- RLS decides whose rows they are, not how many. There is no server of ours to
-- put a request limiter in, so the bound lives here, next to the data.
--
-- Caps on totals rather than requests per minute, because the harm is storage,
-- not traffic: a ceiling holds however slowly it is approached, and needs no
-- table of attempts. Each is far above what a real household reaches — a
-- limit someone meets by planning meals is a bug.
--
-- Text columns are bounded by check constraints on the tables themselves.

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
