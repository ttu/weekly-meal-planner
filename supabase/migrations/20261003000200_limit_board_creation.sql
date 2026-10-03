-- Nothing limited how many boards one person could create.
--
-- Joins were throttled from the start; creation was not. Supabase's own
-- anonymous_users limit caps sign-ins per IP rather than boards, and a
-- signed-in account could make as many as it liked.
--
-- Two limits, because they catch different things: a per-account limit stops
-- one identity making boards in a loop, and a per-IP limit stops the same
-- person doing it behind a pile of fresh anonymous accounts.
create table household_creation_attempt (
  user_id uuid not null,
  -- Null wherever the request did not arrive through PostgREST: the pglite
  -- test harness has no headers, and the per-IP limit simply does not apply
  -- there.
  ip text,
  attempted_at timestamptz not null default now()
);

create index household_creation_attempt_user_idx
  on household_creation_attempt (user_id, attempted_at);
create index household_creation_attempt_ip_idx
  on household_creation_attempt (ip, attempted_at);

alter table household_creation_attempt enable row level security;
-- No policy: only the SECURITY DEFINER function below touches this, and
-- nothing should be able to read how often anyone has tried.

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
