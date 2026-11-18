-- A mailbox for end-to-end-encrypted sync (ADR 0013). The server stores opaque
-- records in the order it received them and checks one thing: that the caller
-- knows the board's current token. It holds no key and reads no plaintext.
--
-- Nothing here is reachable except through the functions below; the tables
-- grant clients nothing and carry no policies, so RLS denies everything.

create table public.relay_board (
  id text primary key check (char_length(id) between 8 and 128),
  epoch integer not null default 1 check (epoch >= 1),
  -- sha256 of the current epoch's token. The token is derived from the epoch
  -- key on the clients, so only Members of that epoch know it.
  token_hash bytea not null,
  last_seq bigint not null default -1,
  created_at timestamptz not null default now()
);

create table public.relay_record (
  board_id text not null references public.relay_board (id) on delete cascade,
  seq bigint not null,
  kind text not null check (kind in ('membership', 'event')),
  epoch integer not null,
  payload text not null check (char_length(payload) <= 65536),
  -- Set here, never by the client: replicas judge a writer's clock against it.
  received_at bigint not null,
  primary key (board_id, seq)
);

-- Every epoch's token, kept after rotation. An old token may still *read* up to
-- the record that ended its epoch, and no further, so a Member who was not cut
-- off can fetch the record carrying their new key, while someone who was sees
-- nothing written after their removal.
create table public.relay_epoch (
  board_id text not null references public.relay_board (id) on delete cascade,
  epoch integer not null,
  token_hash bytea not null,
  ends_at_seq bigint,
  primary key (board_id, epoch)
);

alter table public.relay_board enable row level security;
alter table public.relay_record enable row level security;
alter table public.relay_epoch enable row level security;
revoke all on public.relay_board, public.relay_record, public.relay_epoch from anon, authenticated;

create or replace function public.relay_create(p_board text, p_token text, p_payload text)
returns table (seq bigint, received_at bigint)
language plpgsql
security definer
-- pg_temp last, always (see 20261011000000_pin_pg_temp.sql).
set search_path = public, extensions, pg_temp
as $fn$
declare
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_board is null or p_payload is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'relay_bad_token';
  end if;
  -- Nothing authenticates a caller here, so creation is capped for everyone.
  if (select count(*) from public.relay_board where created_at > now() - interval '1 hour') >= 1000 then
    raise exception 'relay_busy';
  end if;
  begin
    insert into public.relay_board (id, token_hash, last_seq)
    values (p_board, extensions.digest(p_token, 'sha256'), 0);
  exception when unique_violation then
    raise exception 'relay_exists';
  end;
  insert into public.relay_epoch (board_id, epoch, token_hash)
  values (p_board, 1, extensions.digest(p_token, 'sha256'));
  insert into public.relay_record (board_id, seq, kind, epoch, payload, received_at)
  values (p_board, 0, 'membership', 1, p_payload, now_ms);
  return query select 0::bigint, now_ms;
end;
$fn$;

create or replace function public.relay_append(
  p_board text, p_token text, p_epoch integer, p_kind text, p_payload text
) returns table (seq bigint, received_at bigint)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  b public.relay_board;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into b from public.relay_board where id = p_board for update;
  -- One answer for "no such board" and "wrong token", so it cannot be probed.
  -- NULL must fail closed: `NULL <> x` is NULL, and an `if` on NULL does not fire.
  if p_token is null or not found or b.token_hash is distinct from extensions.digest(p_token, 'sha256') then
    raise exception 'relay_forbidden';
  end if;
  if p_epoch is null or p_kind is null or p_payload is null then
    raise exception 'relay_bad_request';
  end if;
  if p_epoch <> b.epoch then
    raise exception 'relay_epoch';
  end if;
  if b.last_seq >= 100000 then
    raise exception 'relay_full';
  end if;
  update public.relay_board set last_seq = last_seq + 1 where id = p_board;
  insert into public.relay_record (board_id, seq, kind, epoch, payload, received_at)
  values (p_board, b.last_seq + 1, p_kind, p_epoch, p_payload, now_ms);
  return query select b.last_seq + 1, now_ms;
end;
$fn$;

-- Moves the board to the next epoch and records the membership change that
-- caused it, in one step, so no write can land between the two.
create or replace function public.relay_rotate(
  p_board text, p_token text, p_new_token text, p_payload text
) returns table (seq bigint, received_at bigint)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  b public.relay_board;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into b from public.relay_board where id = p_board for update;
  -- NULL must fail closed: `NULL <> x` is NULL, and an `if` on NULL does not fire.
  if p_token is null or not found or b.token_hash is distinct from extensions.digest(p_token, 'sha256') then
    raise exception 'relay_forbidden';
  end if;
  -- A little more headroom than append has: removing someone must stay possible on a full board.
  if b.last_seq >= 100100 then
    raise exception 'relay_full';
  end if;
  if p_new_token is null or p_payload is null or p_new_token !~ '^[0-9a-f]{64}$' then
    raise exception 'relay_bad_token';
  end if;
  -- Not the current token, and not any earlier one: taking an old token back would undo a removal.
  if exists (
    select 1 from public.relay_epoch
     where board_id = p_board and token_hash = extensions.digest(p_new_token, 'sha256')
  ) then
    raise exception 'relay_same_token';
  end if;
  update public.relay_board
     set epoch = b.epoch + 1,
         token_hash = extensions.digest(p_new_token, 'sha256'),
         last_seq = last_seq + 1
   where id = p_board;
  update public.relay_epoch set ends_at_seq = b.last_seq + 1
   where board_id = p_board and epoch = b.epoch;
  insert into public.relay_epoch (board_id, epoch, token_hash)
  values (p_board, b.epoch + 1, extensions.digest(p_new_token, 'sha256'));
  insert into public.relay_record (board_id, seq, kind, epoch, payload, received_at)
  values (p_board, b.last_seq + 1, 'membership', b.epoch + 1, p_payload, now_ms);
  return query select b.last_seq + 1, now_ms;
end;
$fn$;

create or replace function public.relay_pull(
  p_board text, p_token text, p_after bigint, p_limit integer default 500
) returns table (seq bigint, kind text, epoch integer, payload text, received_at bigint)
language plpgsql
security definer
stable
set search_path = public, extensions, pg_temp
as $fn$
declare
  e public.relay_epoch;
begin
  if p_token is null or p_after is null then
    raise exception 'relay_forbidden';
  end if;
  select * into e from public.relay_epoch
   where board_id = p_board and token_hash = extensions.digest(p_token, 'sha256');
  if not found then
    raise exception 'relay_forbidden';
  end if;
  return query
    select r.seq, r.kind, r.epoch, r.payload, r.received_at
      from public.relay_record r
     where r.board_id = p_board
       and r.seq > p_after
       and r.seq <= coalesce(e.ends_at_seq, 9223372036854775807)
     order by r.seq
     limit least(greatest(p_limit, 1), 1000);
end;
$fn$;

-- Postgres grants execute to everyone by default; say who is meant to call these.
revoke execute on function
  public.relay_create(text, text, text),
  public.relay_append(text, text, integer, text, text),
  public.relay_rotate(text, text, text, text),
  public.relay_pull(text, text, bigint, integer)
from public;
grant execute on function
  public.relay_create(text, text, text),
  public.relay_append(text, text, integer, text, text),
  public.relay_rotate(text, text, text, text),
  public.relay_pull(text, text, bigint, integer)
to anon, authenticated;
