-- Planning the same Backlog Item twice created two Cook Events.
--
-- Tap a Backlog card twice before the list has caught up — which is what a
-- trackpad does, and what two Members doing the same thing at once looks like
-- — and the Meal was planned twice. The second call passed a Backlog Item id
-- that had already been deleted by the first, and nothing checked.
--
-- The guard belongs here rather than in the UI: a disabled button helps the
-- person who double-tapped and does nothing for the two phones racing.
-- Planning straight onto the board without a Backlog Item is untouched; that
-- path has nothing to be the second of.
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
