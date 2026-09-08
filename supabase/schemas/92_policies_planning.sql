alter table week_plan enable row level security;
alter table backlog_item enable row level security;
alter table cook_event enable row level security;
alter table leftover enable row level security;

create policy week_plan_all on week_plan
  for all using (app.is_member(household_id)) with check (app.is_member(household_id));

create policy backlog_item_all on backlog_item
  for all using (
    exists (
      select 1 from week_plan w
      where w.id = backlog_item.week_plan_id and app.is_member(w.household_id)
    )
  )
  with check (
    exists (
      select 1 from week_plan w
      where w.id = backlog_item.week_plan_id and app.is_member(w.household_id)
    )
  );

create policy cook_event_all on cook_event
  for all using (
    exists (
      select 1 from week_plan w
      where w.id = cook_event.week_plan_id and app.is_member(w.household_id)
    )
  )
  with check (
    exists (
      select 1 from week_plan w
      where w.id = cook_event.week_plan_id and app.is_member(w.household_id)
    )
  );

create policy leftover_all on leftover
  for all using (
    exists (
      select 1 from cook_event c join week_plan w on w.id = c.week_plan_id
      where c.id = leftover.cook_event_id and app.is_member(w.household_id)
    )
  )
  with check (
    exists (
      select 1 from cook_event c join week_plan w on w.id = c.week_plan_id
      where c.id = leftover.cook_event_id and app.is_member(w.household_id)
    )
  );
