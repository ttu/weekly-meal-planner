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
