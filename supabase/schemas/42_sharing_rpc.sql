-- Creating a board.
--
-- SECURITY DEFINER, like join_board and for the same reason: a person creating
-- their first board is not yet a Member of anything, so there is no membership
-- for a policy to check. Making this the only way to create a Household is
-- stronger than a permissive insert policy would be — a client cannot write a
-- household row at all, only ask for a properly formed board.
create or replace function public.create_board(
  p_name text,
  p_display_name text,
  p_colour text,
  p_locale text,
  p_password text
) returns table (out_household_id uuid, out_share_token text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
-- OUT parameter names are deliberately prefixed: plpgsql substitutes bare
-- names into SQL, so an OUT parameter called `share_token` silently shadows the
-- column of the same name inside this function's statements.
as $fn$
declare
  new_id uuid;
  token text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Board password must be at least 6 characters';
  end if;

  insert into household (name, locale, join_password_hash)
  values (
    p_name,
    coalesce(p_locale, 'fi'),
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  )
  returning id, share_token into new_id, token;

  insert into household_member (household_id, user_id, role, display_name, colour)
  values (new_id, auth.uid(), 'owner', p_display_name, p_colour);

  return query select new_id, token;
end;
$fn$;

grant execute on function public.create_board(text, text, text, text, text) to authenticated;

-- Joining a board.
--
-- SECURITY DEFINER, and one of only two functions that is. Someone who is not
-- yet a Member cannot read the Household row to check the token — that is RLS
-- working correctly — so this runs with elevated rights and is written to do
-- exactly one thing.
--
-- It returns a status rather than raising, because a failed attempt has to be
-- *recorded*: raising would abort the transaction and roll the record back, and
-- the rate limit would count nothing. That was a real bug before it was a
-- comment.
--
-- 'rejected' is returned for a wrong token and a wrong password alike. Telling
-- them apart would turn this into an oracle for valid tokens.
create type join_board_status as enum ('joined', 'rejected', 'rate-limited');

create function public.join_board(
  p_share_token text,
  p_password text,
  p_display_name text default 'Member'
) returns table (out_household_id uuid, out_status join_board_status)
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  target record;
  recent integer;
  palette text[] := array['#5F7355', '#C05A38', '#8A8172', '#4A6670'];
  taken integer;
begin
  select count(*) into recent
  from household_join_attempt
  where share_token = p_share_token
    and attempted_at > now() - interval '15 minutes';

  if recent >= 10 then
    return query select null::uuid, 'rate-limited'::join_board_status;
    return;
  end if;

  select id, join_password_hash into target
  from household
  where share_token = p_share_token;

  if target is null
     or extensions.crypt(p_password, target.join_password_hash) <> target.join_password_hash
  then
    insert into household_join_attempt (share_token) values (p_share_token);
    return query select null::uuid, 'rejected'::join_board_status;
    return;
  end if;

  select count(*) into taken from household_member where household_id = target.id;

  insert into household_member (household_id, user_id, role, display_name, colour)
  values (
    target.id,
    auth.uid(),
    'member',
    coalesce(nullif(btrim(p_display_name), ''), 'Member'),
    palette[(taken % array_length(palette, 1)) + 1]
  )
  on conflict (household_id, user_id) do nothing;

  delete from household_join_attempt where share_token = p_share_token;

  return query select target.id, 'joined'::join_board_status;
end;
$fn$;

grant execute on function public.join_board(text, text, text) to authenticated;

-- The attempt table is written only by the definer function; nobody reads it
-- through the client.
alter table household_join_attempt enable row level security;
