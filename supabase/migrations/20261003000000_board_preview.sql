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
set search_path = public
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
