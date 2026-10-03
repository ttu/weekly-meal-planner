-- A board is shared as a URL carrying the token, and joining also needs the
-- password (ADR 0010). The token alone is not enough, because URLs leak through
-- history, referrers and chat previews.
-- base64url, not base64: + / and = are awkward or ambiguous in a URL, and this
-- value's whole job is to travel in one. 32 random bytes, so it is not guessed.
alter table household
  add column share_token text not null
    default translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_'),
  add column join_password_hash text;

create unique index household_share_token_idx on household (share_token);

-- Failed join attempts, so brute force against a family's board password is
-- bounded. Keyed on the token rather than the Household id: a caller who has
-- not joined yet must not learn whether the id exists.
create table household_join_attempt (
  share_token text not null,
  attempted_at timestamptz not null default now()
);

create index household_join_attempt_idx on household_join_attempt (share_token, attempted_at);

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

-- A membership without an account behind it is a ghost: it counts towards the
-- Household, shows a name on Backlog cards, and nothing can ever clean it up.
-- Anonymous identities make this likely rather than theoretical — they are
-- disposable by design (ADR 0010).
--
-- Not added to the base table because auth.users does not exist in the pglite
-- harness; the constraint is real in every deployed environment and the tests
-- cover the behaviour it protects, not the constraint itself.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'auth' and table_name = 'users') then
    alter table household_member
      add constraint household_member_user_fk
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end
$$;
