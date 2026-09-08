create table week_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  week_start date not null,
  unique (household_id, week_start),
  -- ISO weeks start on Monday; extract(isodow) returns 1 for Monday.
  constraint week_start_is_monday check (extract(isodow from week_start) = 1)
);

create table backlog_item (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references week_plan(id) on delete cascade,
  meal_id uuid not null references meal(id) on delete cascade,
  added_by uuid not null,
  created_at timestamptz not null default now()
);

create table cook_event (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references week_plan(id) on delete cascade,
  meal_id uuid not null references meal(id) on delete cascade,
  date date not null,
  -- Deliberately not a foreign key to the Household's slots: Slots are
  -- configuration, and removing one must not delete the Meals planned in it.
  slot_key text not null,
  servings_cooked integer not null check (servings_cooked between 1 and 50),
  from_backlog_item_id uuid,
  created_at timestamptz not null default now()
);

create index cook_event_week_idx on cook_event (week_plan_id, date);

-- No unique constraint on (date, slot_key): two Meals on Tuesday dinner is a
-- supported outcome, not a conflict. Refusing a Member's edit is worse than
-- showing two cards.

-- No meal_id and no servings: a Leftover borrows both from its Cook Event, and
-- the cascade guarantees it can never be stranded (ADR 0004).
create table leftover (
  id uuid primary key default gen_random_uuid(),
  cook_event_id uuid not null references cook_event(id) on delete cascade,
  date date not null,
  slot_key text not null
);

create index leftover_cook_event_idx on leftover (cook_event_id);
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
