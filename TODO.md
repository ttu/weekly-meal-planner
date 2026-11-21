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

- Relay (ADR 0013, `relay/`): board creation is still also capped for everyone
  together (1000 an hour, one `GateObject`). Every call is now limited per IP
  (300 a minute, the `LIMITER` binding), so filling the quota takes many
  addresses; proof-of-work on creation would close it.
- Relay: membership records are capped at 20 a minute per board, so a hostile
  Member cannot keep an admin's removal of them from landing. The same Member
  can make an admin's invite wait a minute; removing them ends it.
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

## Local-first migration (ADR 0013) — what is left

The app runs entirely on the synced board and the relay; Supabase is gone from the
repo. Checked by hand once, in a desktop browser against `wrangler dev` (start a
board, add and plan a Meal, derived Shopping List, reload, invite, join from a
second isolated browser context, remove that Member and watch their device lose
the board). **Not** checked: a deployed relay, a phone or simulator, `fi`, dark vs
light screens beyond Settings, drag and drop, the wide layout. What is left:

1. **Deploy the relay** (`relay/wrangler.toml`; the deploy workflows have never run
   against Cloudflare) and set `EXPO_PUBLIC_RELAY_URL`. Check Durable Objects'
   limits and price, and the cost of every device polling every 15 s.
2. **Rebuild the e2e suite** against `wrangler dev` (`docs/04-testing.md`); the
   Supabase-based one was removed. Until then, look at every screen by hand:
   start, join, share, settings, library, editor, board, shopping, in `fi` and `en`
   and on a wide screen.
3. **Recovery link follow-ups.** The link (Settings) is built. Not yet: a one-tap
   backup to iCloud Keychain / Android Block Store (both need a native module); a
   reminder to save the link. Boards created before the link existed did not seal
   their first key to the creator, so a creator restoring one cannot read
   epoch-1 events until someone else re-delivers that key.
4. **Photos**: resize, encrypt, and store outside the 32 KB record limit.
5. **Event authorship** (see Security): sign events with the Member's key; ignore
   profile cells not written by their own key and settings cells not written by an
   admin; show who wrote what.
6. **Live-ish extras**: feed `useRecentlyChangedDays` from incoming events, and
   consider presence (it needed a live channel).
7. **An outside review of the cryptography and the protocol** before any release.
8. `relay/.wrangler/` (local `wrangler dev` state, 34 files) is committed; untrack
   it and add it to `.gitignore`, so running the relay locally stops dirtying the tree.
9. Known limits: the web vault is `localStorage`; the secure store's value size
   limit may be hit after many epochs; leaving a board leaves its snapshot on the
   device; the row caps are per device view.

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
