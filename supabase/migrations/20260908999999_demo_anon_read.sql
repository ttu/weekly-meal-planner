-- TEMPORARY. Sign-in does not land until plan 02, so an anonymous client sees
-- nothing through RLS and the demo board would be empty. These policies exist
-- for local demonstration only.
--
-- EXPIRES: plan 02, when sign-in lands. Delete this migration then.
-- MUST NEVER be applied to staging or production (docs/06-security.md).
--
-- Numbered last on purpose: it references every table, so it must run after
-- all of them exist.
create policy household_demo_anon_select on household for select to anon using (true);
create policy meal_demo_anon_select on meal for select to anon using (true);
create policy ingredient_demo_anon_select on ingredient for select to anon using (true);
create policy ingredient_name_demo_anon_select on ingredient_name for select to anon using (true);
create policy meal_ingredient_demo_anon_select on meal_ingredient for select to anon using (true);
