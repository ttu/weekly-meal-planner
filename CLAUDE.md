# Weekly Meal Planner

A shared weekly meal board for a household. Members add meals to a weekly
backlog; someone places them on days and slots; the plan derives a shopping list
that leaves the app as a prompt for a browser AI agent, a share, or Apple
Reminders.

**The constraint that outranks the others: planning a week takes two minutes.**
Features that make it longer are features this app does not have.

Stack: Expo (React Native, iOS/Android/web) + Supabase (Postgres, Auth, RLS,
Realtime). No server of our own.

## Read before writing code

| Need                               | Doc                                |
| ---------------------------------- | ---------------------------------- |
| Known bugs and what to do next     | `TODO.md`                          |
| The working agreement              | `docs/00-engineering-standards.md` |
| What it does, and **the glossary** | `docs/01-functional-spec.md`       |
| Where code goes                    | `docs/02-architecture.md`          |
| Tables and types                   | `docs/03-datamodel.md`             |
| How to test it                     | `docs/04-testing.md`               |
| Rules and conventions              | `docs/05-code-quality.md`          |
| Auth, RLS, privacy                 | `docs/06-security.md`              |
| Colours, type, components          | `docs/07-design-system.md`         |
| Why things are the way they are    | `docs/adr/README.md`               |

## Ubiquitous language

The glossary in `docs/01-functional-spec.md` is the single source of naming.
Use these words exactly, everywhere — types, files, columns, tests, commits:

Household · Member · Slot · Week Plan · Meal · Catalogue Meal · Household Meal ·
Backlog Item · **Cook Event** · **Leftover** · Servings · Servings Cooked ·
Ingredient · **Slug** · Dimension · Locale · Staple · Running Low · Shopping List · Buy Line ·
Cupboard Check · Extra · Override · Provenance · Agent Prompt

Not: plan entry, recipe, portion, pantry item, groceries.

## The ten rules

1. No business logic in components
2. No hardcoded user-facing strings — everything through `t()` (fi + en, ADR 0009)
3. No hardcoded colours or font sizes, no inline styles — theme tokens only
4. Server state and client state never mix
5. Prefer `undefined` over `null`
6. Branded types for every domain identifier and quantity
7. No module-level singletons — inject dependencies
8. No `console.*` outside the logger module
9. No cross-feature imports except through `index.ts`
10. No circular dependencies

## Toolchain

**pnpm**, not npm. Node and pnpm are pinned in `.tool-versions` (asdf), Node
again in `.nvmrc`. Run `asdf install` in a fresh checkout.

`.npmrc` sets `node-linker=hoisted` — Metro cannot follow pnpm's symlinked
store. Do not remove it; the symptom is "Unable to resolve module" on packages
that are plainly installed.

Do not bump versions in one file only — `.tool-versions`, `.nvmrc` and
`package.json` (`engines`, `packageManager`) move together; CI reads `.nvmrc`.

## Commands

Always `pnpm run <script>`, never `npx` or a bare binary directly.

```
pnpm run validate      # format:check, lint --max-warnings=0, type-check,
                      # duplication, test, build — the contract, same in CI
pnpm run validate:all  # everything CI runs; pre-push runs this
pnpm run test:watch
pnpm run storybook
pnpm run catalogue:sync  # reference data in data/ -> database (service role)
```

## Workflow

- `TODO.md` is the issue tracker — there is no other one. Anything found and
  not fixed on the spot goes there; anything finished comes out of it in the
  same commit that finishes it.
- TDD by default — red, green, refactor. Tests before implementation.
- Mock only at system boundaries: network, filesystem, clock, randomness,
  third-party SDKs. Real collaborators inside the system.
- Deliver in small runnable increments. A tracer-bullet vertical slice beats a
  complete but unused layer. The system works after every step.
- Conventional commits with a required scope naming the feature slice:
  `feat(planning):`, `fix(shopping):`, `chore(repo):`. One commit per feature —
  implementation, tests and docs together.
- Branch as `feat/`, `fix/`, `chore/`, `refactor/` + slug, in a worktree.
  Never commit to `main`. Never `--no-verify`.

## After any UI change

Run the app, look at it, and check the state you changed plus its empty and
error variants. Keyboard-test anything interactive. A UI change that has not
been looked at is not done.

## Don't

- Don't add a library where a pure function will do
- Don't put feature-specific code in `shared/`
- Don't add authorization checks in application code — RLS is the only
  enforcement point (ADR 0002)
- Don't store the shopping list — it is derived, always (ADR 0003)
- Don't key an Ingredient on its name — identity is the locale-independent slug,
  or the shopping list aggregates `sipuli` and `onion` separately (ADR 0009)
- Don't use amber for anything but the backlog (`docs/07-design-system.md`)
- Don't reach past a feature's `index.ts`
- Don't ask whether to write tests, whether to update docs, or whether to run
  `validate` — the answer is yes
