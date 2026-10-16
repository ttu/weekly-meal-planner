-- A Meal's photo lives in Storage, not in the database: `meal.photo_url` holds
-- the object's path inside this bucket, and the app asks for a signed URL when
-- it needs to show one. An absolute URL in that column is left alone, so a
-- Catalogue Meal can point at a picture we do not host.
--
-- The bucket is private. The sharing model is a link plus a password (ADR
-- 0010), and a public bucket would make a family's photos reachable by link
-- alone — the one thing that model exists to prevent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-photo',
  'meal-photo',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are named `<household_id>/<meal_id>.<ext>`, so the first path
-- segment is the whole of the authorization question. Compared as text rather
-- than cast to uuid: a malformed name must fail the check, not raise.
create or replace function app.owns_meal_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from household_member
    where user_id = auth.uid()
      and household_id::text = split_part(object_name, '/', 1)
  );
$fn$;

create policy meal_photo_select on storage.objects
  for select using (bucket_id = 'meal-photo' and app.owns_meal_photo(name));

-- Writing is narrower than reading: the name must be exactly
-- `<household_id>/<meal_id>.<ext>` for a Meal that exists on the board. Any
-- other name would let a Member upload files without end, each under the size
-- limit; this way a Meal holds at most one per extension.
--
-- That alone does not bound a board: delete the Meal without deleting its
-- photo (the app does, a hostile client need not), make another, repeat. The
-- orphan cannot be removed from SQL — Storage refuses direct deletes, and the
-- file would outlive the row anyway — so the count of a Household's objects is
-- capped here instead. Orphans count against it until removed through the
-- Storage API, which the household-wide delete policy still allows.
create or replace function app.names_own_meal_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic)$'
    and exists (
      select 1
      from household_member hm
      join meal m on m.household_id = hm.household_id
      where hm.user_id = auth.uid()
        and hm.household_id::text = split_part(object_name, '/', 1)
        and m.id::text = split_part(split_part(object_name, '/', 2), '.', 1)
    )
    and (
      select count(*)
      from storage.objects o
      where o.bucket_id = 'meal-photo'
        and o.name like split_part(object_name, '/', 1) || '/%'
    ) < 500;
$fn$;

create policy meal_photo_insert on storage.objects
  for insert with check (bucket_id = 'meal-photo' and app.names_own_meal_photo(name));

create policy meal_photo_update on storage.objects
  for update using (bucket_id = 'meal-photo' and app.owns_meal_photo(name))
  with check (bucket_id = 'meal-photo' and app.names_own_meal_photo(name));

create policy meal_photo_delete on storage.objects
  for delete using (bucket_id = 'meal-photo' and app.owns_meal_photo(name));
