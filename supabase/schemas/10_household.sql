create table household (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  locale text not null default 'fi' check (locale in ('fi', 'en')),
  -- Translation keys, never display text: storing "Lounas" here would make the
  -- board monolingual (ADR 0009).
  slots jsonb not null default
    '[{"key":"lunch","labelKey":"slot.lunch"},{"key":"dinner","labelKey":"slot.dinner"}]'::jsonb
    check (length(slots::text) <= 4000),
  -- How many people the Household cooks for: the number a new Meal starts at.
  -- Same range as meal.servings, so the default is never one the editor refuses.
  size integer not null default 4 check (size between 1 and 50),
  created_at timestamptz not null default now()
);

create table household_member (
  household_id uuid not null references household(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null check (length(display_name) between 1 and 40),
  avatar_url text check (length(avatar_url) <= 2048),
  colour text not null check (length(colour) <= 16),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_member_user_idx on household_member (user_id);
