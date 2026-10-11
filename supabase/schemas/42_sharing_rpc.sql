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
  caller_ip text;
  recent integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Board password must be at least 6 characters';
  end if;

  -- The first address in x-forwarded-for, or nothing when there are no
  -- headers to read.
  caller_ip := split_part(
    coalesce(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
      ''
    ),
    ',',
    1
  );
  caller_ip := nullif(btrim(caller_ip), '');

  select count(*) into recent
  from household_creation_attempt
  where user_id = auth.uid() and attempted_at > now() - interval '1 hour';

  if recent >= 5 then
    raise exception 'Too many boards created. Wait an hour.';
  end if;

  if caller_ip is not null then
    select count(*) into recent
    from household_creation_attempt
    where ip = caller_ip and attempted_at > now() - interval '1 hour';

    if recent >= 20 then
      raise exception 'Too many boards created. Wait an hour.';
    end if;
  end if;

  insert into household_creation_attempt (user_id, ip) values (auth.uid(), caller_ip);

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
-- pg_temp last, always. Left out, Postgres searches the caller's temp schema
-- *first*, and every unqualified name in here becomes theirs to redefine: a
-- temp table called household_join_attempt made this function's own rate limit
-- count nothing, which is all that stands between a family's board password
-- and unlimited guessing.
set search_path = public, extensions, pg_temp
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

-- What a person sees before they are let in.
--
-- The join screen used to say "Join this board" and ask for a password with no
-- indication of whose board it is. The design names the household and the
-- people already planning — "Dad and Mum are already planning. Ask one of them
-- for the board password" — which turns a password prompt into something a
-- person can act on.
--
-- This does disclose a household's name and its Members' first names to anyone
-- holding the link, before they know the password. That is consistent with
-- ADR 0010's threat model: the share token is 32 random bytes and is not
-- guessable, so the only way to reach this is to have been sent the link. The
-- real attack it defends against is brute-forcing the password, and that is
-- still rate-limited and still answers the same for a wrong link and a wrong
-- password.
--
-- SECURITY DEFINER because the caller is not a Member yet, so RLS would show
-- them nothing. It returns names and nothing else: no ids, no token, no hash.
create or replace function public.board_preview(p_share_token text)
returns table (out_name text, out_member_names text[], out_member_colours text[])
language plpgsql
security definer
-- pg_temp last; see join_board above.
set search_path = public, pg_temp
as $fn$
begin
  return query
  select h.name,
         coalesce(array_agg(m.display_name order by m.role desc, m.display_name), '{}'),
         coalesce(array_agg(m.colour order by m.role desc, m.display_name), '{}')
  from household h
  left join household_member m on m.household_id = h.id
  where h.share_token = p_share_token
  group by h.name;
end;
$fn$;

grant execute on function public.board_preview(text) to anon, authenticated;
