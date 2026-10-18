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

- The beta key (ADR 0012) is not yet in the staging or production Vault, so
  both are still open until someone runs `vault.create_secret` there
  (`docs/06-security.md`). Once email verification exists, delete the secret
  and then the gate: `p_beta_key`, `app.beta_key_accepted`, the screen field.
- Two advisories are ignored in `package.json` (`pnpm.auditConfig.ignoreGhsas`)
  because no patched release exists: `node-forge` (GHSA-86w9-cpqp-85rv) via
  `@expo/cli`, and `braces` (GHSA-vfj7-8cjw-p6xm) via
  `vite-plugin-commonjs`. Both are dev-tooling only and never reach the
  shipped bundle. When a fixed version is published, add an override for it and
  delete the ignore.
- The git guardrail hook (`.claude/hooks/block-dangerous-git.sh`) matches
  text, and automated security reviews of PR #2 keep finding spellings past
  it. Two are open: its quote tracking can be misled (a `#` comment, `$'...'`)
  so brace expansion is not seen, and a git config file reached through a glob
  (`~/.gitc*`) or from inside `.git` is not caught by its path rules. Both
  bypass only the local rules, not GitHub's. Rather than more patterns, close
  the config route in the container for good: point `GIT_CONFIG_GLOBAL` at a
  root-owned file in `/etc` that `post-create.sh` writes and then locks, so
  neither Bash nor Edit/Write can add an alias, include or autocorrect.

## Household

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
