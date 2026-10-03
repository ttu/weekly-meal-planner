-- Planning and unplanning each change two tables and must not half-happen: a
-- Backlog Item deleted without its Cook Event loses the Meal from the week
-- entirely. Two client statements cannot be atomic; these can.
--
-- security invoker is deliberate. These must not become a way around RLS —
-- they run as the caller, so every policy still applies (ADR 0002).
--
-- They live in `public` rather than `app` because PostgREST only exposes
-- functions in the exposed schemas; `app` holds internal helpers like
-- is_member, which must stay unreachable from the client.

-- p_backlog_item_id is last and defaulted: planning straight onto the board,
-- without going via the Backlog, is a valid path.
create or replace function public.plan_meal(
  p_week_plan_id uuid,
  p_meal_id uuid,
  p_date date,
  p_slot_key text,
  p_servings_cooked integer,
  p_added_by uuid,
  p_backlog_item_id uuid default null
) returns uuid
language plpgsql
security invoker
as $fn$
declare
  new_id uuid;
  claimed uuid;
begin
  if p_backlog_item_id is not null then
    delete from backlog_item where id = p_backlog_item_id returning id into claimed;
    -- Already gone: the first caller planned it, and this is the echo.
    if claimed is null then
      return null;
    end if;
  end if;

  insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked,
                          from_backlog_item_id, added_by)
  values (p_week_plan_id, p_meal_id, p_date, p_slot_key, p_servings_cooked,
          p_backlog_item_id, p_added_by)
  returning id into new_id;

  return new_id;
end;
$fn$;

create or replace function public.unplan_meal(p_cook_event_id uuid)
returns uuid
language plpgsql
security invoker
as $fn$
declare
  new_id uuid;
  ce record;
begin
  select * into ce from cook_event where id = p_cook_event_id;
  if ce is null then
    return null;
  end if;

  insert into backlog_item (week_plan_id, meal_id, added_by)
  values (ce.week_plan_id, ce.meal_id, coalesce(ce.added_by, auth.uid()))
  returning id into new_id;

  -- Cascades to this Cook Event's Leftovers (ADR 0004).
  delete from cook_event where id = p_cook_event_id;

  return new_id;
end;
$fn$;

grant execute on function public.plan_meal(uuid, uuid, date, text, integer, uuid, uuid) to authenticated;
grant execute on function public.unplan_meal(uuid) to authenticated;
