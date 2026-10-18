-- Closes the direct door into a Household, and tidies what grew around it.
--
-- household_insert (20260908000000_household.sql) was never dropped when
-- create_board became the only way in (ADR 0010). With the bootstrap branch on
-- household_member_insert it let any signed-in caller, anonymous ones included,
-- create a Household and make themselves its owner without the beta key, the
-- creation limits or a board password. The pglite tests load supabase/schemas,
-- which never had the policy, so they could not see it.
drop policy if exists household_insert on household;
drop policy if exists household_member_insert on household_member;

-- A policy decides rows, not columns: a Member could rewrite share_token and
-- join_password_hash.
revoke update on household from anon, authenticated;
grant update (name, locale, slots) on household to authenticated;

-- Wrong joins are counted per account as well as per token.
alter table household_join_attempt add column if not exists user_id uuid;
create index if not exists household_join_attempt_user_idx on household_join_attempt (user_id, attempted_at);

-- Foreign keys read by cascades and RLS joins, and the age of attempt rows.
create index if not exists meal_copied_from_idx on meal (copied_from_meal_id) where copied_from_meal_id is not null;
create index if not exists meal_ingredient_ingredient_idx on meal_ingredient (ingredient_id);
create index if not exists cook_event_meal_idx on cook_event (meal_id);
create index if not exists backlog_item_week_idx on backlog_item (week_plan_id);
create index if not exists backlog_item_meal_idx on backlog_item (meal_id);
create index if not exists household_join_attempt_age_idx on household_join_attempt (attempted_at);
create index if not exists household_creation_attempt_age_idx on household_creation_attempt (attempted_at);
create index if not exists beta_key_attempt_age_idx on beta_key_attempt (attempted_at);

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

-- One call in twenty, so the three deletes are not paid on every request. A row
-- lives a little longer than a day on average; nothing reads them past an hour.
create or replace function app.purge_stale_attempts_sometimes()
returns void
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if random() < 0.05 then
    perform app.purge_stale_attempts();
  end if;
end;
$fn$;

revoke execute on function app.purge_stale_attempts_sometimes() from public;

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
  perform app.purge_stale_attempts_sometimes();

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

create or replace function public.join_board(
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

  -- Per account, across tokens. The account lock taken by
  -- beta_key_guesses_exhausted above is still held, so this count and the
  -- insert below are one step.
  if (select count(*) from household_join_attempt
      where user_id = auth.uid() and attempted_at > now() - interval '1 hour') >= 20
  then
    return query select null::uuid, 'rate-limited'::join_board_status;
    return;
  end if;

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
    insert into household_join_attempt (share_token, user_id) values (p_share_token, auth.uid());
    perform app.purge_stale_attempts_sometimes();
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
