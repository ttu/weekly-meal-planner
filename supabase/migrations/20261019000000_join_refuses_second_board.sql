-- join_board refuses a Member of another board with 'already-member'.
-- The app assumes one board per account and has no way to leave one; a second
-- membership made the board load arbitrary or failing. Joining the same board
-- again stays a no-op. See supabase/schemas/42_sharing_rpc.sql.
alter type join_board_status add value if not exists 'already-member';

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

  if exists (select 1 from household_member
             where user_id = auth.uid() and household_id <> target.id)
  then
    return query select null::uuid, 'already-member'::join_board_status;
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

