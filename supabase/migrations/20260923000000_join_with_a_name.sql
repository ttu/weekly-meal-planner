-- Everyone who joined a board was called "Member" and wore the same colour.
--
-- On a board with one other person that is merely impersonal; on a family of
-- four it destroys the thing the Backlog card exists for. "Who wanted this?"
-- is half the reason a shared board beats a list on the fridge, and three
-- identical grey avatars answer it with "somebody".
--
-- The name now comes from the person joining, and the colour is dealt from the
-- same palette the app uses, by how many Members are already there — so a
-- household of four gets four different faces without anyone choosing.
-- Dropped rather than replaced: adding a defaulted third argument would leave
-- two overloads behind, and PostgREST cannot choose between them.
drop function if exists public.join_board(text, text);

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
