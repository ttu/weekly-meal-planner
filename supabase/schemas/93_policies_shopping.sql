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
