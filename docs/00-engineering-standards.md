# 00 — Engineering Standards

The working agreement for this project, as given. This document is the source;
`02`–`08` are its application to this codebase. Where a later doc appears to
contradict this one, this one wins and the other is a bug.

## Architecture

- Use domain driven design
  - We should have common ubiquitous language — the functional spec glossary is the single source of naming, used in types, files, columns, tests, commits
  - Model the domain explicitly; domain logic stays free of framework and IO concerns
  - Push impurity to the edges — network, filesystem, clock, randomness, third-party SDKs live in `infrastructure`; inject the clock and random source
  - Extract genuinely pure domain logic into its own package when reused across app, jobs, and tests
- Use vertical slice architecture
  - Organize by feature, not technical layer: `features/<feature>/{domain,application,infrastructure,ui,api,index.ts}` + `shared/`
  - Each feature owns its internals
  - Cross-feature access is allowed only through explicit public interfaces (the `index.ts` barrel)
  - Shared code must be generic and reusable; do not place feature-specific logic in shared
  - Move code to shared only after multiple real use cases justify it
  - Enforce boundaries mechanically (`eslint-plugin-boundaries` / dependency-cruiser), not by review
  - Ban circular dependencies
- Pick one authorization enforcement point
  - Either a server-side authorization layer or database row-level security — never both inconsistently, never neither
- Data as code
  - Keep stable reference data in version control, schema-validated at load, synced to the DB by a script

## Code Quality

- Build small, composable UI components
  - Keep components focused and easy to reuse
  - Prefer composition over large monolithic components
  - Extract a named sub-component when a block earns a name: a section comment, a 15+ line conditional branch, 4+ levels of nesting, a repeated inline pattern
  - Keep hooks and side effects near feature/application boundaries; presentational components take props and render
  - Use Storybook for reusable UI components — stories cover all states, sizes, error/empty variants, and are part of "done"
- Write Clean, Readable Code
  - Use clear, descriptive names taken from the ubiquitous language
  - Keep functions small and focused on one responsibility
  - Add comments only for non-obvious intent, constraints, or trade-offs
  - Prefer self-documenting code — if a comment explains *what*, extract and name it instead
  - Doc comments on complex business logic (the why and the formula), not on obvious signatures
- Follow Good Practices:
  - Keep code modular and reusable
  - Avoid duplication (DRY principle) — and make it a build gate (jscpd threshold), not a reviewer's judgment
  - Make dependencies explicit and clear — inject them, no module-level singletons
  - Prefer functional patterns
  - Prefer composition over inheritance
  - Use pure functions whenever possible (no side effects)
  - Separate data from logic — plain data plus pure transformations over behavior-carrying objects
- Keep a short, checkable project rule list
  - No business logic in components
  - No hardcoded user-facing strings — everything through the translation function
  - No hardcoded colors or font sizes — theme tokens only; no inline styles
  - Server state and client state use different mechanisms — never mix them
  - Prefer `undefined` over `null`
  - Branded types for all domain identifiers
  - Short enough to remember, specific enough to lint

## Type Safety

- Maintain Type Safety
  - For domain types use e.g. branded types — for every domain identifier *and quantity*, so arguments can't be swapped
  - Use strong typing when language supports it — TypeScript `strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`
  - Avoid loosely-typed constructs (e.g., `any`, `void*`, untyped dicts, unsafe casts)
  - Leverage type inference where appropriate — inside functions; be explicit at public boundaries
  - Validate at the edge, trust inside — schema-validate every external boundary (HTTP bodies, query params, env vars, imported JSON, local storage) and derive static types from the schemas

## Testing

- TDD
  - Follow red-green-refactor pattern
  - Write tests before implementation by default
  - Mock only at system boundaries (network, filesystem, time, random, third-party services)
  - Prefer real collaborators inside the system over excessive mocking
  - Ensures quality, maintainability, test coverage
- All functionality must be tested
  - Ensure all important behavior is covered by automated tests
  - Use test diamond strategy — roughly 70% integration / 20% E2E / 10% unit (unit = pure logic only, E2E = critical flows only)
  - Prefer integration tests over mocks when validating collaboration between modules
  - For integration tests prefer in-memory databases — pglite for Postgres in-process; Testcontainers when vendor-specific behavior matters; avoid SQLite standing in for Postgres
  - E2E selectors: `data-testid` only — never CSS classes, text content, or structural position; `getByRole`/`aria-label` preferred for interactive controls
  - Coverage policy: project `target: auto` (never decrease) + hard floor on the patch (80% for new code)
  - Mutation testing (Stryker) scoped to pure logic, run on a schedule — write behavior tests to close real gaps, not mutant-killing tests
  - Also worth having: accessibility tests (axe), visual regression in the vendor's container image, story smoke tests, authorization tests

## Delivery & Quality Gates

- Incremental delivery
  - Deliver work in small, runnable increments
  - Prefer user-visible progress early when applicable — a tracer-bullet vertical slice beats a complete but unused layer
  - After each step, the system should remain in a working state
- Automatic code validation and formatting
  - After each step format and lint code
  - One `validate` script is the contract — format:check, lint (`--max-warnings=0`), type-check, duplication, test, build; CI runs the same steps
  - Always use `npm run <script>`; never invoke tools directly via `npx`
- Pre-commit, pre-push hooks and CI quality gates
  - Execute most CI steps locally before pushing (`validate:all`)
  - Pre-commit: lint-staged + type-check + tests + build, fast enough that nobody wants to skip it
  - Pre-push: refuse to push a branch that isn't rebased on latest `main`
  - Never `--no-verify`. If an escape hatch is needed, make it loud (`SKIP_HOOKS=1` with a warning)
  - CI mirrors local gates as parallel jobs; upload artifacts on failure; cache deps and install from the lockfile; preview deployment per PR
  - Adopt tooling incrementally — each step green before the next — rather than all at once

## Runtime Concerns

- Handle Errors Properly
  - Validate inputs and handle edge cases at the boundary, then trust the types inside
  - Use appropriate error handling mechanisms (try-catch at the boundary, typed `Result`/error returns inside the domain)
  - Don't throw for expected outcomes — a locked record or invalid submission is a domain result, model it
  - Provide clear, actionable error messages
  - Never swallow errors silently — an empty `catch {}` or a failure-hiding fallback is a bug; if you truly ignore an error, log it and say why
- Consider Performance
  - Profile before optimizing (avoid premature optimization)
  - Use appropriate data structures and algorithms
  - Cache expensive computations when appropriate
  - Be mindful of memory usage and leaks (subscriptions, listeners, intervals, unbounded caches)
  - Memoize UI where measurement shows it matters, not by default
  - If front-end performance matters, put budgets in CI (bundle size, Lighthouse) — otherwise it's a sentiment, not a practice
- Security & Validation
  - Validate and sanitize all external inputs
  - Follow security best practices for the language/framework
  - Never trust user input
  - Use parameterized queries to prevent injection attacks
  - Enforce authorization server-side or in the database — never in the client
  - Keep secrets out of the client bundle; any public-prefixed env var is public by definition
  - Add dependency and secret scanning to CI
  - Document the security model: authentication, authorization, data retention, privacy/GDPR
- Be Concise
  - Focus only on what's required; avoid unnecessary complexity (YAGNI - You Aren't Gonna Need It)
- Ensure observability
  - Add structured logging at important boundaries (request handlers, jobs, auth, external calls)
  - Log with context, not prose
  - Make failures debuggable — correlation ids and the inputs that produced the failure
  - Add metrics/tracing for critical flows where appropriate
  - Do not log secrets or sensitive user data — configure redaction in the logger itself and ban `console.*` outside the logger module
- Add accessibility for UI work
  - Prefer semantic HTML
  - Ensure keyboard accessibility — full keyboard access, visible focus, logical tab order
  - Label inputs properly
  - Maintain sufficient contrast (WCAG 2.1 AA: 4.5:1 body, 3:1 large text and UI components)
  - Use accessible component patterns rather than hand-rolled dropdowns and dialogs
  - Automate the floor (`eslint-plugin-jsx-a11y` + axe); the rest is manual keyboard testing

## Documentation

- Keep documentation up to date
  - All main functionalities should have own design docs — numbered, with an index README
  - Main architecture, datamodel, testing etc. documentations: functional spec (with the glossary), technical spec, architecture, datamodel, testing, code quality, security, deployments, plans
  - ADRs record decisions and are immutable; design docs describe how a feature works now and are updated
  - Docs are updated in the same commit as the code; if behavior changed and no doc did, the change is incomplete
  - Keep a `docs-sync` check and a handoff/progress doc so work isn't bound to one session or contributor
- Treat agent-facing docs as first-class
  - A compact `CLAUDE.md`/`AGENTS.md` entry point: context, quality rules, conventions, version control, commands, doc table, definition of done
  - Prompt templates for recurring tasks and an explicit "don't ask for" anti-pattern list
  - A mandatory visual verification loop after UI changes

## Version Control

- Version control
  - Use conventional commits — `type(scope): description`; enforced with commitlint
  - Trailer footers (`Co-Authored-By`, `Refs: #issue`, tool attribution) are fine
  - Scope is required and names the feature slice it touches (`feat(pools):`, `fix(auth):`); use `repo` for cross-cutting/tooling changes
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`, `build`, `perf`
  - Keep commit and PR descriptions short — a one-line subject plus a few bullets; the *what* and *why*, not a narrative of the work. Detail belongs in the design doc or ADR
  - One commit per feature: implementation, tests, and docs together; don't commit design specs separately
  - PRs are squash-merged, so multiple commits on a branch are fine — don't squash locally
  - Use worktrees and feature branches — `feat/`/`fix/`/`chore/`/`refactor/` + slug; copy gitignored env files and install deps in each worktree; verify upstream is set
  - Never commit directly to `main`
  - Block destructive git operations (`push --force`, `reset --hard`, `clean -fd`, `branch -D`) with a hook

## Definition of done

- Code is implemented and follows the practices above
- Relevant tests exist and pass (TDD, behavior covered per the test diamond)
- Storybook stories exist for new reusable UI components
- Formatting, linting, type checks, and duplication checks pass
- Documentation is updated when needed, in the same commit
- The increment is runnable; the system is in a working state
- Error cases are handled; nothing is swallowed silently
- Accessibility verified for UI changes (keyboard, labels, contrast)
- No `--no-verify`; `validate` passed locally before pushing
