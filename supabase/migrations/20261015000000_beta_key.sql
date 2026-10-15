-- A beta key in Supabase Vault gates starting and joining boards until email
-- verification exists. See supabase/schemas/12_beta_key.sql for the whole
-- story; this migration brings a database up to it.
--
-- Both board functions gain a trailing p_beta_key parameter. A new parameter
-- is a new signature, so the old ones are dropped: left in place, they would
-- be a way round the key.

-- The beta key.
--
-- Anonymous boards (ADR 0010) let anyone with the app start one. Until email
-- verification exists, a shared key closes starting and joining a board to
-- people who have been given it. The key lives in Supabase Vault as the secret
-- named 'beta_key', set per project in the dashboard; with no such secret there
-- is no gate. Removing the secret is how the gate comes off.
--
-- Checked here and nowhere else: a key checked by the app is a key anyone can
-- skip by calling the RPC directly.

-- Whether a key was given that lets the caller through. Security invoker, and
-- not in an exposed schema: only the SECURITY DEFINER board functions call it,
-- and run as anyone else it cannot read the Vault at all.
create or replace function app.beta_key_accepted(p_key text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select not exists (select 1 from vault.decrypted_secrets where name = 'beta_key')
      or exists (
        select 1 from vault.decrypted_secrets
        where name = 'beta_key' and decrypted_secret = p_key
      );
$fn$;

revoke execute on function app.beta_key_accepted(text) from public;

-- Whether the start and join screens should ask for the key at all. Says
-- whether a key exists and nothing about it.
create or replace function public.beta_key_required()
returns boolean
language sql
stable
security definer
set search_path = '', pg_temp
as $fn$
  select exists (select 1 from vault.decrypted_secrets where name = 'beta_key');
$fn$;

grant execute on function public.beta_key_required() to anon, authenticated;

alter type join_board_status add value if not exists 'invalid-beta-key';

drop function public.create_board(text, text, text, text, text);
drop function public.join_board(text, text, text);

create or replace function public.create_board(
  p_name text,
  p_display_name text,
  p_colour text,
  p_locale text,
  p_password text,
  p_beta_key text default null
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

  -- 12_beta_key.sql. Raised with invalid_password so the app can tell this
  -- refusal from every other one without matching on the message.
  if not app.beta_key_accepted(p_beta_key) then
    raise exception 'Invalid beta key' using errcode = 'invalid_password';
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
begin
  select count(*) into recent
  from household_join_attempt
  where share_token = p_share_token
    and attempted_at > now() - interval '15 minutes';

  if recent >= 10 then
    return query select null::uuid, 'rate-limited'::join_board_status;
    return;
  end if;

  -- After the rate limit and recorded like a wrong password: a wrong key is a
  -- guess too, and must not be a second door with no limit on it.
  if not app.beta_key_accepted(p_beta_key) then
    insert into household_join_attempt (share_token) values (p_share_token);
    return query select null::uuid, 'invalid-beta-key'::join_board_status;
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
