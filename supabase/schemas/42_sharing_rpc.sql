-- The first address in x-forwarded-for, or nothing when there are no headers to
-- read.
create or replace function app.caller_ip()
returns text
language sql
stable
set search_path = '', pg_temp
as $fn$
  select nullif(btrim(split_part(
    coalesce(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
      ''
    ),
    ',',
    1
  )), '');
$fn$;

-- Whether this account, or this address, has already guessed the beta key
-- wrong too often. Checked before the key is, and refusing the right key too:
-- a limit that a correct guess slips past does not bound guessing.
--
-- Takes a lock on the account and on the address first, held until the
-- transaction ends, so the count and the record of a wrong guess that follows
-- it are one step. Without it a burst of parallel guesses each reads the same
-- count and all pass. Always the account before the address, so two requests
-- cannot wait on each other. Volatile for the same reason: a stable function
-- counts against the caller's snapshot, taken before the lock was won.
create or replace function app.beta_key_guesses_exhausted(p_user_id uuid, p_ip text)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  perform pg_advisory_xact_lock(hashtextextended('beta_key_user:' || p_user_id::text, 0));
  if p_ip is not null then
    perform pg_advisory_xact_lock(hashtextextended('beta_key_ip:' || p_ip, 0));
  end if;

  if (select count(*) from beta_key_attempt
      where user_id = p_user_id and attempted_at > now() - interval '1 hour') >= 10
  then
    return true;
  end if;

  return p_ip is not null
    and (select count(*) from beta_key_attempt
         where ip = p_ip and attempted_at > now() - interval '1 hour') >= 30;
end;
$fn$;

-- The attempt tables are write-mostly: every wrong guess adds a row, and nothing
-- else removes one. Rows older than a day are past every window above, so they
-- count for nothing. Run from the two functions that write them, so no scheduler
-- is needed.
create or replace function app.purge_stale_attempts()
returns void
language sql
set search_path = public, pg_temp
as $fn$
  delete from household_join_attempt where attempted_at < now() - interval '1 day';
  delete from household_creation_attempt where attempted_at < now() - interval '1 day';
  delete from beta_key_attempt where attempted_at < now() - interval '1 day';
$fn$;

revoke execute on function app.purge_stale_attempts() from public;
revoke execute on function app.caller_ip() from public;
revoke execute on function app.beta_key_guesses_exhausted(uuid, text) from public;

-- Creating a board.
--
-- SECURITY DEFINER, like join_board and for the same reason: a person creating
-- their first board is not yet a Member of anything, so there is no membership
-- for a policy to check. Making this the only way to create a Household is
-- stronger than a permissive insert policy would be — a client cannot write a
-- household row at all, only ask for a properly formed board.
--
-- A wrong beta key comes back as a status, not an exception, for the reason
-- join_board does: the guess has to be recorded, and a raise would roll the
-- record back.
create type create_board_status as enum ('created', 'invalid-beta-key');

create or replace function public.create_board(
  p_name text,
  p_display_name text,
  p_colour text,
  p_locale text,
  p_password text,
  p_beta_key text default null
) returns table (out_household_id uuid, out_share_token text, out_status create_board_status)
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

  caller_ip := app.caller_ip();

  -- 12_beta_key.sql. Guesses are counted by account and by address, and the
  -- count is read before the key is.
  if app.beta_key_guesses_exhausted(auth.uid(), caller_ip) then
    raise exception 'Too many attempts. Wait an hour.';
  end if;

  if not app.beta_key_accepted(p_beta_key) then
    insert into beta_key_attempt (user_id, ip) values (auth.uid(), caller_ip);
    return query select null::uuid, null::text, 'invalid-beta-key'::create_board_status;
    return;
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Board password must be at least 6 characters';
  end if;

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
  perform app.purge_stale_attempts();

  insert into household (name, locale, join_password_hash)
  values (
    p_name,
    coalesce(p_locale, 'fi'),
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  )
  returning id, share_token into new_id, token;

  insert into household_member (household_id, user_id, role, display_name, colour)
  values (new_id, auth.uid(), 'owner', p_display_name, p_colour);

  return query select new_id, token, 'created'::create_board_status;
end;
$fn$;

grant execute on function public.create_board(text, text, text, text, text, text) to authenticated;

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
--
-- 'invalid-beta-key' is checked before the token is looked at, so it says
-- nothing about whether the link is real (12_beta_key.sql). Wrong keys are
-- counted against the caller, not the link: the link is the one thing a
-- guesser can change on every try, and it keeps its own attempts for the board
-- password.
create type join_board_status as enum ('joined', 'rejected', 'rate-limited', 'invalid-beta-key');

create function public.join_board(
  p_share_token text,
  p_password text,
  p_display_name text default 'Member',
  p_beta_key text default null
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
  caller_ip text := app.caller_ip();
begin
  if app.beta_key_guesses_exhausted(auth.uid(), caller_ip) then
    return query select null::uuid, 'rate-limited'::join_board_status;
    return;
  end if;

  if not app.beta_key_accepted(p_beta_key) then
    insert into beta_key_attempt (user_id, ip) values (auth.uid(), caller_ip);
    return query select null::uuid, 'invalid-beta-key'::join_board_status;
    return;
  end if;

  -- A real token is 43 characters. Anything this long is not one, and is not
  -- worth a row in the attempt table.
  if length(p_share_token) > 100 then
    return query select null::uuid, 'rejected'::join_board_status;
    return;
  end if;

  perform app.purge_stale_attempts();

  -- Same reason as the beta key lock: without it a burst of parallel guesses
  -- each reads the same count and all pass. After the account and address locks
  -- taken above, always in that order.
  perform pg_advisory_xact_lock(hashtextextended('join_token:' || p_share_token, 0));

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

grant execute on function public.join_board(text, text, text, text) to authenticated;

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
