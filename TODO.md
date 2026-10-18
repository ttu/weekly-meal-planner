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

## Tests

- The e2e suite waits out animations, navigation and the auto-scroll dwell with
  `page.waitForTimeout` in six places, so `sonarjs/no-fixed-wait-in-tests` is
  off for `e2e/**`. Found when the sonarjs rules were added. Replace each with
  a wait on an observable condition and delete the exception from
  `eslint.config.mjs`; doing it as its own pass so a flake is attributable.

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
