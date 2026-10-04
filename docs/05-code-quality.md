# 05 — Code Quality

## The rule list

Short enough to remember, specific enough to lint. Every one of these has a
lint rule or a build gate behind it.

1. **No business logic in components.** Components take props and render;
   decisions live in `domain` or `application`.
2. **No hardcoded user-facing strings.** Everything through `t()`.
3. **No hardcoded colours or font sizes, no inline styles.** Theme tokens only.
4. **Server state and client state never mix.** TanStack Query for one, local
   state for the other.
5. **Prefer `undefined` over `null`.** `null` stops at the infrastructure edge.
6. **Branded types for every domain identifier and quantity.**
7. **No module-level singletons.** Dependencies are injected.
8. **No `console.*` outside the logger module.**
9. **No cross-feature imports except through `index.ts`.**
10. **No circular dependencies.**

## TypeScript

`strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`.
`any`, non-null assertions and unsafe casts are lint errors, not warnings.

Inference inside functions; explicit types at public boundaries — every
`index.ts` export is annotated.

## Components

Extract a named sub-component when a block earns a name: a section comment, a
15+ line conditional branch, four levels of nesting, or a pattern repeated
inline. The board will push against this hardest — seven days × N slots ×
four card variants — so the card variants are separate components from the
start, not a `variant` prop with a switch inside.

Hooks and side effects sit at the feature boundary. Presentational components
are pure functions of their props, which is also what makes their Storybook
stories worth writing.

## Storybook

Every reusable UI component has stories, and stories are part of "done", not a
follow-up. Each covers all states, sizes, and the error and empty variants. For
this app that specifically means: a meal card with and without a photo, with a
very long Finnish compound name, in all four variants; a shopping row ticked,
unticked, overridden and expanded; a day with zero, one and two meals.

## Errors

Try/catch at the boundary; typed `Result` returns inside the domain. Expected
outcomes are not exceptions — a meal with no ingredients, a slot removed from
the household config, a queued write that lost a race are all domain results,
modelled and rendered.

Never swallow an error. An empty `catch {}` is a lint error. If an error really
is ignorable, it is logged with the reason it is ignorable.

## Lint

Beyond `typescript-eslint`'s `strictTypeChecked` and the boundary rules,
`eslint-plugin-sonarjs`' recommended set runs over everything: bug patterns,
needless complexity (cognitive complexity capped at 15 per function), nested
ternaries, nested template literals, and test smells like a generic
`.length === n` where `toHaveLength(n)` reports what the length actually was.

Prefer fixing a violation over disabling the rule. Where a disable is right it
goes in `eslint.config.mjs` with a one-line reason next to it, scoped as
narrowly as the problem. What is off today:

| Rule                            | Scope               | Why                                           |
| ------------------------------- | ------------------- | --------------------------------------------- |
| `todo-tag`                      | everywhere          | `TODO.md` is the issue tracker; code names it |
| `no-unused-vars`                | everywhere          | redundant with the type-aware rule            |
| `no-hardcoded-secrets`          | tests, scripts, e2e | fixtures and demo logins are fake on purpose  |
| `no-hardcoded-passwords`        | tests, scripts, e2e | same                                          |
| `no-os-command-from-path`       | e2e                 | `docker` off the developer's PATH             |
| `publicly-writable-directories` | e2e                 | throwaway screenshots under `/tmp`            |
| `no-fixed-wait-in-tests`        | e2e                 | real debt, tracked in `TODO.md`               |

The last one is different in kind from the others: it is deferred, not
permanent. The e2e suite waits out animations and the auto-scroll dwell with
fixed sleeps, and replacing them with observable conditions is a pass of its
own.

Eight rules sonarjs ships off are on here, each turned on only once the
codebase was already clean of it — a ratchet, not a backlog:

| Rule                       | Scope      | Why                                             |
| -------------------------- | ---------- | ----------------------------------------------- |
| `no-implicit-dependencies` | everywhere | hoisted `node_modules` hides undeclared imports |
| `no-commented-code`        | everywhere | git history is the record of what was done      |
| `no-return-type-any`       | everywhere | the return half of `no-explicit-any`            |
| `prefer-immediate-return`  | everywhere | readability                                     |
| `no-collapsible-if`        | everywhere | readability                                     |
| `useless-string-operation` | everywhere | dead `.trim()` / `.toLowerCase()`               |
| `no-nested-switch`         | everywhere | readability                                     |
| `composite-assertions`     | tests, e2e | a failing composite says which half failed      |
| `no-networkidle-wait`      | e2e        | a guess about timing dressed up as a wait       |

`no-implicit-dependencies` earns its place: `.npmrc` sets
`node-linker=hoisted`, so an import of a package nobody declared resolves
happily until the tree is built some other way. It found `@storybook/react`
being imported by the stories while only its framework package was declared.

React's own rules run over every `.tsx`: `eslint-plugin-react`'s recommended
set with `jsx-runtime` (this codebase never imports React), and all sixteen
rules from `eslint-plugin-react-hooks` bar two.

**On `react/jsx-max-depth`:** four levels, and the fix is always to extract the
inner block into a named component — never to raise the ceiling. The board is
seven days x N Slots x four card variants, and it only stays readable if each
of those is a thing with a name. Test wrappers and stories are exempt: nesting
providers is structural, not a readability problem.

Two hook rules are off, and both are off because they cannot read React Native:

| Rule                       | Why                                                            |
| -------------------------- | -------------------------------------------------------------- |
| `react-hooks/immutability` | every Reanimated `shared.value = …` looks like a mutation      |
| `react-hooks/refs`         | cannot see through a hook returning a ref beside its callbacks |

Reanimated's `.value` write is the only way to drive a frame from a worklet,
and `useEdgeAutoScroll` returns a ref alongside `onScroll` — so the compiler
counts reading its result as reading a ref during render. Both are false here
every time. The other fourteen hook rules stay on, `rules-of-hooks` and
`exhaustive-deps` included.

`eslint-plugin-react` does not yet claim ESLint 10 support, and its React
version _detection_ calls an API ESLint 10 removed — so the version is pinned
in `settings` instead. Every rule itself works.

Rules deliberately left off: `no-undefined-assignment` contradicts rule 5,
`no-inconsistent-returns` flags the standard `useEffect` cleanup, and
`cyclomatic-complexity` says again what the cognitive-complexity cap already
says. `no-redundant-parentheses` would argue with Prettier.

## Duplication

`jscpd` with a threshold in `validate`. DRY is a build gate here, not a
reviewer's judgement call.

`minTokens` is raised to 75 (`minLines` 12) so the gate reports duplicated
_logic_, not duplicated import headers and four-line mutation wrappers. At the
default it flagged things whose only fix was to make the code less readable,
which teaches people to route around the gate rather than listen to it.

Real duplications it has caught and that were extracted rather than suppressed:
`formStyles`, `resolveLocalisedName`, `partitionMeals`, and shopping reading
Ingredients through `loadIngredients` instead of repeating the query.

## Observability

Structured logging at boundaries: auth, every Supabase call that fails, the
offline queue flush, the catalogue sync. Log context, not prose. Correlation id
per session so a family's bug report is traceable.

Redaction is configured in the logger itself — meal names and member display
names are personal data and never reach logs.

## Accessibility

Semantic elements, labelled inputs, visible focus, logical tab order, and
WCAG 2.1 AA contrast (4.5:1 body, 3:1 large text and UI components). The
terracotta accent and the amber backlog edge both need checking against the
paper ground before they ship — amber on light is the likely failure.

Automated floor: `eslint-plugin-jsx-a11y` and axe. Above the floor, manual
keyboard testing of the board and the plan sheet.

## Performance

Profile before optimising. Memoise where measurement says so, not by default.
Watch for leaks in the places this app actually has them: realtime
subscriptions, presence channels, and the offline queue's listeners.

Budgets in CI once there is a UI to measure — bundle size, and cold start on a
mid-range Android. Until then it is a sentiment, and it is labelled as one.

## The `validate` contract

One script, run identically locally and in CI:

```
pnpm run validate   # format:check, lint --max-warnings=0, type-check,
                   # duplication, test, build
```

Always `pnpm run <script>`; never `npx` directly. Tooling is adopted
incrementally — each gate green before the next is added.

## Hooks

- **Pre-commit:** lint-staged, type-check, tests, build. Fast enough that nobody
  wants to skip it.
- **Pre-push:** refuses a branch not rebased on latest `main`.
- Destructive git operations (`push --force`, `reset --hard`, `clean -fd`,
  `branch -D`) are blocked by a hook.
- Never `--no-verify`. The escape hatch is `SKIP_HOOKS=1`, and it prints a
  warning.

## Version control

Conventional commits, enforced by commitlint. Scope is required and names the
feature slice: `feat(planning):`, `fix(shopping):`, `chore(repo):`. Types:
`feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`, `build`,
`perf`.

One commit per feature — implementation, tests and docs together. Design specs
are not committed separately from the code they describe. Subjects are one line
plus a few bullets; the narrative belongs in the design doc or an ADR.

Branches are `feat/`, `fix/`, `chore/`, `refactor/` plus a slug, worked in
worktrees, squash-merged. Never commit directly to `main`.
