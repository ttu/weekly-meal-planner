-- The database stamps marked_low_at and shopping_extra.checked_at, never the
-- phone (see supabase/schemas/50_shopping.sql). Existing rows are left as they
-- are; unchecking an Extra still clears checked_at.
create or replace function app.stamp_marked_low_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.running_low then
    new.marked_low_at := case
      when tg_op = 'UPDATE' and old.running_low then old.marked_low_at
      else now()
    end;
  elsif tg_op = 'UPDATE' then
    new.marked_low_at := old.marked_low_at;
  else
    new.marked_low_at := null;
  end if;
  return new;
end;
$fn$;

drop trigger if exists household_staple_stamp on household_staple;
create trigger household_staple_stamp before insert or update on household_staple
  for each row execute function app.stamp_marked_low_at();

create or replace function app.stamp_checked_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.checked_at is not null then
    new.checked_at := case
      when tg_op = 'UPDATE' and old.checked_at is not null then old.checked_at
      else now()
    end;
  end if;
  return new;
end;
$fn$;

drop trigger if exists shopping_extra_stamp on shopping_extra;
create trigger shopping_extra_stamp before insert or update of checked_at on shopping_extra
  for each row execute function app.stamp_checked_at();
