-- SECURITY DEFINER so the membership lookup is not subject to the policy it
-- supports, which would recurse infinitely.
create or replace function app.is_member(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from household_member
    where household_id = h and user_id = auth.uid()
  );
$fn$;

alter table household enable row level security;
alter table household_member enable row level security;

create policy household_select on household
  for select using (app.is_member(id));

-- No insert policy on household on purpose. A Household is created only through
-- create_board (ADR 0010), which is SECURITY DEFINER and controls every column
-- it writes — including the share token and the hashed board password. A client
-- cannot write a household row directly.

create policy household_update on household
  for update using (app.is_member(id)) with check (app.is_member(id));

create policy household_member_select on household_member
  for select using (app.is_member(household_id));

-- The second branch lets the first Member of a brand-new Household create their
-- own membership. Without it, creating a Household is impossible: nobody is a
-- member yet, so app.is_member is false for everyone.
create policy household_member_insert on household_member
  for insert with check (
    app.is_member(household_id)
    or not exists (
      select 1 from household_member existing
      where existing.household_id = household_member.household_id
    )
  );
