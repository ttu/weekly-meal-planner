# TODO

This file is the issue tracker. There is no other one.

**How it works.** Anything found and not fixed on the spot goes here, in the
section that matches what it is. Each item says what is wrong or missing and
how it was found, because "why do we believe this" is the part that rots
first. Work through it top-down within a section; the order inside a section is
roughly the order worth doing them in.

**When you finish one**, delete the line — git history is the record of what
was done, and a file full of struck-through text is a file nobody reads. Put
the reasoning in the commit message instead.

**What does not belong here:** anything in the "Non-goals for v1" list in
`docs/01-functional-spec.md`. That list is a scope decision, not a backlog. If
you want to overturn one, change the spec first.

---

## Security

- Relay (ADR 0013, `relay/`): board creation is capped for everyone together
  (1000 an hour, one `GateObject`) because nothing identifies the caller, so
  anyone can fill the quota and block new boards for an hour. A per-caller gate
  needs an identity: Cloudflare's rate-limit binding per IP, or proof-of-work on
  creation.
- Relay: `rotate` is authorised by the current epoch token alone, so any
  current Member could move the board to a token only they know and lock the
  others out, and nothing recovers it. It is a denial of service by someone
  already in the family, not a way to read data. The fix is an admin-only
  rotation secret (or a signature the relay checks), distributed in `setRole`
  ops and rotated on demotion, plus a client that reports a rotation record
  that is not a valid removal instead of stalling quietly.
- The beta key (ADR 0012) is not yet in the staging or production Vault, so
  both are still open until someone runs `vault.create_secret` there
  (`docs/06-security.md`). Once email verification exists, delete the secret
  and then the gate: `p_beta_key`, `app.beta_key_accepted`, the screen field.
- Two advisories are ignored in `package.json` (`pnpm.auditConfig.ignoreGhsas`)
  because no compatible patched release exists. `zod` (GHSA-mrhx-c7xc-m3w5)
  via `@expo/cli`, which pins `zod@^3` and the fix is only in 4.6.6;
  dev-tooling only. `decode-uri-component` (GHSA-qr28-fpjm-wq7f) via
  `expo-router` > `query-string@7`, which `require()`s it, while the fixed
  0.5.1 is ESM-only with a default export; this one does reach the bundle, but
  the input is the app's own URL, so the worst case is a crafted link hanging
  the tab that opened it. When `@expo/cli` moves to zod 4 or `expo-router` to a
  fixed `query-string`, delete the ignore.
- The git guardrail hook (`.claude/hooks/block-dangerous-git.sh`) matches
  text, and automated security reviews of PR #2 keep finding spellings past
  it. Two are open: its quote tracking can be misled (a `#` comment, `$'...'`)
  so brace expansion is not seen, and a git config file reached through a glob
  (`~/.gitc*`) or from inside `.git` is not caught by its path rules. Both
  bypass only the local rules, not GitHub's. Rather than more patterns, close
  the config route in the container for good: point `GIT_CONFIG_GLOBAL` at a
  root-owned file in `/etc` that `post-create.sh` writes and then locks, so
  neither Bash nor Edit/Write can add an alias, include or autocorrect.

## Local-first migration (ADR 0013)

The sync core and the relay (a Cloudflare Worker, `relay/`) are built and tested
(`docs/11-sync.md`), but nothing in the app uses them yet: every screen still
reads Supabase. Supabase goes entirely, relay included. In order, each its own
commit, and the app must run after each:

0. **Deploy the relay** (`relay/wrangler.toml`; never run against Cloudflare
   yet) and set `EXPO_PUBLIC_RELAY_URL`.

1. ~~Provider and sync loop~~ done: `SyncProvider`, `useView`, `useData`, `startSyncLoop`,
   device identity in the secure store. It mounts only when `EXPO_PUBLIC_RELAY_URL`
   is set. Known limits: the web vault is `localStorage`; the secure store's value
   size limit may be hit after many epochs (the vault holds every epoch key).
2. ~~Household slice~~ done in the app shell: start, join by invite link, share,
   Members (promote, remove) in Settings, settings as synced rows. Still on
   Supabase and broken at runtime until their slices move: Meals, Planning and
   Shopping read `useSession().client` and the Supabase RLS identity, which no
   longer exists. Left to remove with them: `createSupabaseClient`, the
   `client` field of `SessionProvider`, `Household`'s Supabase-era fields,
   `demo-accounts`, `e2e` and `scripts/seed*`. Presence ("also here") is gone;
   it needed a live channel.
3. ~~Meals slice~~ done: Household Meals are `meal:<id>` rows, the Catalogue ships
   as JSON from `data/catalogue`, copy/save/delete are client functions with the
   unit-dimension rules checked on save. **Photos are gone** from the editor: they
   need encrypted blob storage, and a record holds at most 32 KB of plaintext, so
   a photo needs resizing plus a chunked or separate encrypted store. Deleting a
   Meal leaves planned rows pointing at nothing; the Planning slice must hide
   them (and their Leftovers).
4. ~~Planning slice~~ and 5. ~~Shopping slice~~ done: Backlog Items, Cook Events,
   Leftovers, checks, Staples and Extras are rows keyed by the week's Monday (no
   Week Plan row). `plan_meal`/`unplan_meal` are client functions where planning a
   Backlog Item gives the Cook Event the Item's own id, so two Members planning it
   at once converge on one; the row caps are enforced where the write is made.
   The Realtime hooks and presence are gone, and so is the "this day just changed"
   highlight (`useRecentlyChangedDays` is never fed): feed it from the engine's
   incoming events. Backlog and week caps are per device view, not global: two
   offline devices can together exceed a cap.
5. **Recovery and cleanup.** A recovery seat for a lost last device; remove
   Supabase entirely: Auth, the household tables, RLS, `supabase/`, the
   `@supabase/supabase-js` and `supabase` packages, PGlite fixtures,
   `db:*` scripts and `catalogue:sync`; rewrite `docs/03`, `06`, `02`; supersede ADRs 0002 and 0010.
6. **Event authorship.** Events are not signed per author, so any Member can
   write as another. Sign them with the Member's key and show who wrote what.
   This also covers: a Member can overwrite another's `member:<key>` profile
   (name, colour), and anyone can write the admin-only `household:main` settings,
   because `readMembers` and `readSettings` do not check who wrote a cell. Ignore
   profile cells not written by their own key, and settings cells not written by
   an admin.

## Household

- Invites (ADR 0013): a link is a seat that stays valid until an admin removes it,
  with no expiry or single use, and unclaimed seats show only as "Unnamed"
  Members. Add an expiry and a list of unclaimed invites to revoke. Also, leaving
  a board does not delete its snapshot or keys from the device (`KeyValue` has no
  delete).

- One board per account is enforced only by `join_board` (`already-member`);
  `create_board` still lets a Member start a second board, and
  `household_member` has no unique `user_id`. Decide with `leave_board` below.
- A Member cannot leave a board or change their own name or colour:
  `household_member` has no update or delete policy, and the only writers are
  `create_board` and `join_board`. Needs a decision on what leaving means for
  the last Member and for their Backlog Items, then a `leave_board` /
  `update_member` RPC. Found in the Supabase review that closed the direct
  `household_insert` door.

## Tests

- Nothing compares the policies, grants and indexes of the migrated database
  with `supabase/schemas`, and the pglite tests only see the schemas. A policy
  that lives only in a migration (`household_insert` did, until 20261018000000) is invisible to every test. Add a check that diffs the two
  (`supabase db diff --local`) and fails on any difference; `schema_paths` in
  `config.toml` is empty, so nothing generates one from the other today.
- The e2e suite waits out animations, navigation and the auto-scroll dwell with
  `page.waitForTimeout` in six places, so `sonarjs/no-fixed-wait-in-tests` is
  off for `e2e/**`. Found when the sonarjs rules were added. Replace each with
  a wait on an observable condition and delete the exception from
  `eslint.config.mjs`; doing it as its own pass so a flake is attributable.

## UI

- `PlanSheet` still closes only by button, backdrop or Android back; it has no
  swipe-down. It is a `ScrollView` that owns its surface, so moving it onto
  `shared/ui/Sheet` means restructuring it (the ScrollView goes inside the
  Sheet's `contentStyle` area). Left alone because other work is editing it.
  Found in the client-side review of sheets.
- `MealPicker` and `IngredientPicker` are full-screen, opaque modals with a
  long scrolling list and a search field; a swipe-down would fight the list
  for the gesture, so they were not moved onto `Sheet`. They want a visible
  close/back control checked instead. `ConfirmSheet` is a centred confirmation
  and stays as is.

## Client

- `MealPicker` still draws a failed or loading Meal library as "no results":
  it takes `meals` as a prop and is not told the `loadState` that
  `MealLibraryScreen` now receives from `useHouseholdMeals`. Found while making
  failed loads stop looking empty; left because the picker was being edited
  elsewhere. Pass `loadState`/`onRetry` through and use `Loading`/`LoadError`.
- On the wide board, a failed refresh of both the week and the Meal library
  stacks two `Notice` banners at the same spot (both are absolutely
  positioned at the bottom). Merge them into one notice, or offset the second.
- Other loaders (`useIngredients`, `useMeal`, `useMealActions`) were not
  audited for the same "error read as empty" pattern; the repositories now
  return `query-failed`, but the hooks over them have not been checked.
