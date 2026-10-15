# 0011 — Named Menami, served at menami.app

Status: Accepted · 2026-10-15

## Context

The app shipped as "Meal Planner" — a description, not a name, and an English
one. It runs in Finnish and English from the start (ADR 0009) and should not
need renaming for a third Locale. A family member's first sight of it is a bare
invite link in a chat, and nothing on the screens behind that link said what
the app was.

## Decision

The app is called **Menami**, and its address is **menami.app**.

- "Menu" is read the same way across most languages (menú, menü, меню, メニュー),
  and "nam" is close to the sound of _yum_ in many of them — Finnish _nam nam_,
  Spanish _ñam_, French _miam_. Three open syllables: said one way, spelled back
  after hearing it once.
- The name is a brand, not copy: `app.name` is the same in every Locale file,
  kept there so screens still take every visible string from `t()`.
- Every screen someone reaches before they are on a board — start, sign in,
  enter an invite, join — shows it as a wordmark above the title.
- The identifiers follow the address: URL scheme `menami://`, bundle identifier
  and Android package `app.menami`, and `https://menami.app` as the origin of
  invite links shared from a device.

## Consequences

- Nothing has been published to a store yet, so the bundle identifier changed
  for free. After the first store release it cannot change again.
- Email-auth redirects to `menami://settings` must be allow-listed in the hosted
  Supabase project's auth settings as well as in `supabase/config.toml`.
- The local Supabase `project_id` keeps its old value: renaming it renames the
  Docker containers and volumes, and would throw away every developer's local
  database for no user-visible gain.
- menami.com is held by someone else. The app does not depend on it.
