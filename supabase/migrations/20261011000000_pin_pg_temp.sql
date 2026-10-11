-- Both SECURITY DEFINER functions that a non-Member can call pinned a
-- search_path without pg_temp on the end. Postgres then searches the caller's
-- own temporary schema first, so every unqualified name inside them was the
-- caller's to redefine.
--
-- join_board was the one that mattered. Its rate limit reads
-- household_join_attempt unqualified, so a temp table of that name made the
-- limiter count zero attempts, every time: verified against this database,
-- where the same call answered 'rate-limited' before the temp table existed
-- and 'rejected' after it. Ten guesses per fifteen minutes is the only thing
-- bounding a brute force against a board password the app deliberately asks
-- people to make memorable.
--
-- The password check itself was never reachable this way — crypt() is
-- schema-qualified — and board_preview leaks nothing either way, but it is
-- fixed alongside so the rule holds everywhere rather than case by case.

create or replace function public.join_board(
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
