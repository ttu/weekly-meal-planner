-- A Meal and its Ingredient rows must arrive together: a Meal saved without its
-- Ingredients silently drops them from the Shopping List. Two client statements
-- cannot be atomic; this can.
--
-- security invoker, like the planning RPCs: RLS still applies (ADR 0002).
create or replace function public.save_meal(
  p_household_id uuid,
  p_name text,
  p_servings integer,
  p_ingredients jsonb,
  p_meal_id uuid default null
) returns uuid
language plpgsql
security invoker
as $fn$
declare
  target_id uuid;
begin
  if p_meal_id is null then
    insert into meal (household_id, name, servings)
    values (p_household_id, p_name, p_servings)
    returning id into target_id;
  else
    update meal set name = p_name, servings = p_servings
    where id = p_meal_id and household_id = p_household_id
    returning id into target_id;

    if target_id is null then
      raise exception 'Meal not found or not writable';
    end if;

    -- Replace rather than accumulate: the editor sends the whole list.
    delete from meal_ingredient where meal_id = target_id;
  end if;

  insert into meal_ingredient (meal_id, ingredient_id, quantity, unit, optional)
  select target_id,
         (row ->> 'ingredientId')::uuid,
         (row ->> 'quantity')::numeric,
         row ->> 'unit',
         coalesce((row ->> 'optional')::boolean, false)
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) as row;

  return target_id;
end;
$fn$;

grant execute on function public.save_meal(uuid, text, integer, jsonb, uuid) to authenticated;
