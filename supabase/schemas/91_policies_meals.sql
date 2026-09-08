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
