-- See supabase/schemas/70_meal_photos.sql.
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

drop policy if exists meal_photo_select on storage.objects;
drop policy if exists meal_photo_insert on storage.objects;
drop policy if exists meal_photo_update on storage.objects;
drop policy if exists meal_photo_delete on storage.objects;

create policy meal_photo_select on storage.objects
  for select using (bucket_id = 'meal-photo' and app.owns_meal_photo(name));

create policy meal_photo_insert on storage.objects
  for insert with check (bucket_id = 'meal-photo' and app.owns_meal_photo(name));

create policy meal_photo_update on storage.objects
  for update using (bucket_id = 'meal-photo' and app.owns_meal_photo(name))
  with check (bucket_id = 'meal-photo' and app.owns_meal_photo(name));

create policy meal_photo_delete on storage.objects
  for delete using (bucket_id = 'meal-photo' and app.owns_meal_photo(name));
