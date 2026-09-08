-- TEMPORARY. Sign-in does not land until plan 02, so an anonymous client sees
-- nothing through RLS and the demo board would be empty. These policies exist
-- for local demonstration only.
--
-- EXPIRES: plan 02, when sign-in lands. Drop this migration then.
-- MUST NEVER be applied to staging or production (docs/06-security.md).
create policy household_demo_anon_select on household for select to anon using (true);
