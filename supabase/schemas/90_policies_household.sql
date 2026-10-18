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

-- A policy decides which rows, not which columns. Supabase grants every column
-- to authenticated by default, so without this a Member could rewrite
-- share_token or join_password_hash. The app edits exactly these four
-- (Settings: slots, locale and size; name for a rename). A new column a Member
-- should edit has to be added here, in the same change.
revoke update on household from anon, authenticated;
grant update (name, locale, slots, size) on household to authenticated;

create policy household_member_select on household_member
  for select using (app.is_member(household_id));

-- No insert policy on household_member either. Memberships are written only by
-- create_board and join_board (SECURITY DEFINER). The bootstrap branch this
-- table once had ("a Household with no Members accepts one") let any signed-in
-- caller make themselves owner of an empty Household, and let a Member add
-- anyone, with any role.
