# Foundation and Tracer Bullet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in Member opens the app and sees their Household's board for
this week, with real Cook Events read from Supabase — with every quality gate in
place and green.

**Architecture:** Expo (React Native) app, vertical slices under `src/features`,
domain logic pure and free of IO, Supabase Postgres with row-level security as
the sole authorization point. Integration tests run against pglite in-process.
This plan builds a thin vertical slice through every layer rather than a
complete layer nobody uses.

**Tech Stack:** Expo + Expo Router, TypeScript strict, Supabase (Postgres,
Auth, RLS), TanStack Query, Zod, i18next, Jest (two projects: node + jest-expo),
pglite, Storybook (react-native-web-vite), ESLint + Prettier +
eslint-plugin-boundaries + dependency-cruiser + jscpd, Husky + lint-staged +
commitlint, GitHub Actions.

**Spec:** `docs/01-functional-spec.md` (with the glossary), supported by
`docs/00-engineering-standards.md`, `docs/02-architecture.md`,
`docs/03-datamodel.md`, `docs/04-testing.md`, `docs/05-code-quality.md`,
`docs/06-security.md`, `docs/07-design-system.md`, and ADRs 0001–0009.

## Global Constraints

Every task's requirements implicitly include this section.

- **Ubiquitous language.** Use the glossary in `docs/01-functional-spec.md`
  verbatim in types, files, columns, tests and commit scopes: Household, Member,
  Slot, Week Plan, Meal, Catalogue Meal, Household Meal, Backlog Item,
  **Cook Event**, **Leftover**, Servings, Servings Cooked, Ingredient, Slug,
  Dimension, Locale, Staple, Running Low, Shopping List, Buy Line, Cupboard
  Check, Extra, Override, Provenance, Agent Prompt. Never: plan entry, recipe,
  portion, pantry item, groceries.
- **The ten rules** from `docs/05-code-quality.md`. Most relevant here: no
  business logic in components; no hardcoded user-facing strings; no hardcoded
  colours or font sizes and no inline styles; server and client state never mix;
  prefer `undefined` over `null`; branded types for every identifier and
  quantity; no module-level singletons; no `console.*` outside the logger; no
  cross-feature imports except through `index.ts`; no circular dependencies.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. `any`, non-null
  assertions and unsafe casts are lint errors.
- **Authorization is RLS only** (ADR 0002). Never an authorization check in
  application code.
- **Locales are exactly `fi` and `en`** (ADR 0009). Every user-facing string
  goes through `t()` and exists in both files.
- **Ingredient identity is `slug`**, never a name (ADR 0009).
- **Colour tokens** (`docs/07-design-system.md`): `paper #F7F2E9`,
  `paperDeep #EDE6D9`, `ink #24211C`, `muted #6B6459`, `card #FFFFFF`,
  `tint #EFE8DA`, `rule #DBD2C1`, `terracotta #C05A38`,
  `terracottaDeep #9C4529`, `sage #5F7355`, `amber #E8B04B`. Token names are
  semantic in code (`surfaceRaised`, not `white`) so the undesigned dark theme
  is a value swap.
- **Amber is the Backlog colour and is used nowhere else.**
- **Commits:** conventional, scope required, naming the feature slice
  (`feat(planning):`, `chore(repo):`). One commit per task.
- **Always `npm run <script>`**, never `npx`. The single exception is the
  one-time project scaffold in Task 1, which has no package.json to run from
  yet; it is called out explicitly there.
- **Never `--no-verify`.** Never commit to `main` — work on
  `feat/01-foundation`.

---

### Task 1: Repo scaffold, Expo app, TypeScript strict, the `validate` contract

**Files:**
- Create: `package.json`, `tsconfig.json`, `app.json`, `.prettierrc`,
  `eslint.config.mjs`, `src/app/_layout.tsx`, `src/app/index.tsx`
- Create: `.github/` (empty for now, filled in Task 10)

**Interfaces:**
- Consumes: nothing
- Produces: `npm run validate` (format:check → lint → type-check → test →
  build), and a runnable Expo app. Every later task extends `validate` rather
  than adding a parallel script.

- [ ] **Step 1: Scaffold the Expo app**

This is the one command in the project run outside `npm run` — there is no
package.json to run from yet.

```bash
git checkout -b feat/01-foundation
npx create-expo-app@latest . --template blank-typescript
npm install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants
npm install -D prettier eslint typescript-eslint eslint-plugin-react-hooks @eslint/js
```

- [ ] **Step 2: Set TypeScript to the strict configuration**

Replace `tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "*.config.ts"]
}
```

- [ ] **Step 3: Configure ESLint with the non-negotiable rules**

Create `eslint.config.mjs`:

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
      'no-restricted-syntax': ['error', {
        selector: 'TSAsExpression[typeAnnotation.typeName.name!="const"]',
        message: 'Unsafe cast. Construct branded values through a parser at the edge.',
      }],
    },
  },
  { ignores: ['dist/**', '.expo/**', 'node_modules/**'] },
)
```

The `no-restricted-syntax` rule bans `as` casts outside `as const`. Branded
values are constructed by parsers at the edge, never by casting — see Task 5.
Test files legitimately need casts to build fixtures, so add an override
allowing them in `**/*.test.ts` and `**/*.test.tsx` and `**/*.stories.tsx`:

```js
{
  files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx', 'src/test/**'],
  rules: { 'no-restricted-syntax': 'off' },
}
```

- [ ] **Step 4: Add the validate scripts**

In `package.json` `"scripts"`:

```json
{
  "start": "expo start",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "lint": "eslint . --max-warnings=0",
  "type-check": "tsc --noEmit",
  "test": "jest --passWithNoTests",
  "build": "expo export --platform web",
  "validate": "npm run format:check && npm run lint && npm run type-check && npm run test && npm run build",
  "validate:all": "npm run validate"
}
```

`test` uses `--passWithNoTests` only until Task 3 adds the first test; remove the
flag then.

- [ ] **Step 5: Create the Expo Router entry**

Set `"main": "expo-router/entry"` in `package.json`, add
`"scheme": "mealplanner"` to `app.json`, and create `src/app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
```

And `src/app/index.tsx`:

```tsx
import { Text, View } from 'react-native'

export default function Index() {
  return (
    <View testID="app-root">
      <Text>Meal Planner</Text>
    </View>
  )
}
```

This screen is replaced in Task 9. It exists so `validate` has something to
build.

- [ ] **Step 6: Run validate and confirm it is green**

Run: `npm run validate`
Expected: all five steps pass. Fix anything that does not before continuing —
this script is the contract every later task depends on.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(repo): scaffold Expo app with strict TypeScript and validate contract"
```

---

### Task 2: Mechanical boundaries — slices, cycles, duplication, hooks

**Files:**
- Create: `.dependency-cruiser.cjs`, `.jscpd.json`, `commitlint.config.cjs`,
  `.husky/pre-commit`, `.husky/pre-push`, `.husky/pre-push-git-guard`
- Modify: `eslint.config.mjs`, `package.json`

**Interfaces:**
- Consumes: `npm run validate` from Task 1
- Produces: `validate` extended with `lint:boundaries` and `lint:duplication`.
  Directory layout `src/features/<name>/{domain,application,infrastructure,ui}`
  and `src/shared` is from here on enforced, not conventional.

- [ ] **Step 1: Write the failing boundary test**

Create the directories and a deliberate violation so the rule can be proven to
fire:

```bash
mkdir -p src/features/planning/domain src/features/meals/infrastructure src/shared
```

Create `src/features/planning/domain/violation.probe.ts`:

```ts
// Temporary probe: proves eslint-plugin-boundaries rejects a deep cross-feature
// import. Deleted in Step 5 of this task.
export { thing } from '../../meals/infrastructure/thing'
```

Create `src/features/meals/infrastructure/thing.ts`:

```ts
export const thing = 'probe'
```

- [ ] **Step 2: Install and configure the boundary rules**

```bash
npm install -D eslint-plugin-boundaries dependency-cruiser jscpd @commitlint/cli @commitlint/config-conventional husky lint-staged
```

Add to `eslint.config.mjs` (a new config object appended to the array):

```js
{
  plugins: { boundaries: (await import('eslint-plugin-boundaries')).default },
  settings: {
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/**' },
      { type: 'feature-public', pattern: 'src/features/*/index.ts', mode: 'full' },
      { type: 'feature-internal', pattern: 'src/features/*/**' },
      { type: 'shared', pattern: 'src/shared/**' },
    ],
  },
  rules: {
    'boundaries/element-types': ['error', {
      default: 'disallow',
      rules: [
        { from: 'app', allow: ['feature-public', 'shared'] },
        { from: 'feature-public', allow: ['feature-internal', 'shared'] },
        { from: 'feature-internal', allow: ['feature-internal', 'feature-public', 'shared'] },
        { from: 'shared', allow: ['shared'] },
      ],
    }],
  },
}
```

The `feature-internal → feature-internal` allowance is intentionally broad: it
permits a feature's own files to import each other. The rule that matters is
that nothing outside a feature can reach `feature-internal`, because
`feature-public` (`index.ts`) is a distinct element type matched first.

- [ ] **Step 3: Run lint and verify the violation is caught**

Run: `npm run lint`
Expected: FAIL, reporting that `src/features/planning/domain/violation.probe.ts`
may not import an element of type `feature-internal`.

If it passes, the rule is not working — do not proceed. The most likely cause is
`mode: 'full'` missing from the `feature-public` element, which makes `index.ts`
match `feature-internal` first.

- [ ] **Step 4: Configure cycle and duplication detection**

Create `.dependency-cruiser.cjs`:

```js
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-orphans', severity: 'warn', from: { orphan: true, pathNot: ['\\.d\\.ts$'] }, to: {} },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsConfig: { fileName: 'tsconfig.json' } },
}
```

Create `.jscpd.json`:

```json
{
  "threshold": 3,
  "reporters": ["consoleFull"],
  "absolute": true,
  "gitignore": true,
  "path": ["src"],
  "ignore": ["**/*.test.ts", "**/*.test.tsx", "**/*.stories.tsx"]
}
```

Tests and stories are excluded because near-identical test setup is clarity, not
debt, and a duplication gate that fires on it teaches people to write worse
tests.

Add scripts:

```json
{
  "lint:boundaries": "depcruise src --config .dependency-cruiser.cjs",
  "lint:duplication": "jscpd",
  "validate": "npm run format:check && npm run lint && npm run lint:boundaries && npm run lint:duplication && npm run type-check && npm run test && npm run build"
}
```

- [ ] **Step 5: Delete the probe files and confirm validate is green**

```bash
rm src/features/planning/domain/violation.probe.ts src/features/meals/infrastructure/thing.ts
npm run validate
```

Expected: PASS.

- [ ] **Step 6: Install the hooks**

```bash
npm run prepare --if-present || npx husky init
```

Create `commitlint.config.cjs`:

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'type-enum': [2, 'always', ['feat','fix','refactor','test','docs','style','chore','ci','build','perf']],
  },
}
```

Add to `package.json`:

```json
{
  "lint-staged": { "*.{ts,tsx,js,json,md}": ["prettier --write"] }
}
```

Create `.husky/pre-commit`:

```sh
if [ "$SKIP_HOOKS" = "1" ]; then
  echo "⚠️  SKIP_HOOKS=1 — pre-commit checks bypassed. This is not normal."
  exit 0
fi
npx lint-staged
npm run type-check
npm run test
```

Create `.husky/commit-msg`:

```sh
npx commitlint --edit "$1"
```

Create `.husky/pre-push`:

```sh
if [ "$SKIP_HOOKS" = "1" ]; then
  echo "⚠️  SKIP_HOOKS=1 — pre-push checks bypassed. This is not normal."
  exit 0
fi

git fetch origin main --quiet
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "✖ Branch is not rebased on latest origin/main. Rebase before pushing."
  exit 1
fi
npm run validate:all
```

- [ ] **Step 7: Verify commitlint rejects a bad message**

Run: `echo "added stuff" | npx commitlint`
Expected: FAIL, complaining about missing type and scope.

Run: `echo "feat(planning): add cook event" | npx commitlint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(repo): enforce slice boundaries, cycles, duplication and commit conventions"
```

---

### Task 3: Shared kernel — branded types, Result, clock, theme tokens, i18n

**Files:**
- Create: `src/shared/types/brand.ts`, `src/shared/types/result.ts`,
  `src/shared/time/clock.ts`, `src/shared/theme/tokens.ts`,
  `src/shared/i18n/index.ts`, `src/shared/i18n/locales/fi.json`,
  `src/shared/i18n/locales/en.json`, `src/shared/logger/logger.ts`
- Test: `src/shared/types/result.test.ts`, `src/shared/time/clock.test.ts`
- Create: `jest.config.js`, `jest.setup.node.js`

**Interfaces:**
- Consumes: `validate` from Task 2
- Produces:
  - `Brand<T, B>`, and the constructors used by every later task
  - `Result<T, E>` with `ok(value)`, `err(error)`, `isOk(r)`, `isErr(r)`
  - `Clock` port: `{ now(): Date }`, plus `fixedClock(iso: string): Clock`
  - `tokens.color.*`, `tokens.type.*`, `tokens.space.*`
  - `t(key, params?)` and `useTranslation()`

- [ ] **Step 1: Configure Jest with two projects**

```bash
npm install -D jest @types/jest ts-jest jest-expo
```

Create `jest.config.js`:

```js
module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.node.js'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'native',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
}
```

Create an empty `jest.setup.node.js` with a single line:

```js
jest.setTimeout(20000)
```

The 20-second timeout exists for the pglite tests added in Task 4; a cold pglite
boot is slower than a default 5-second Jest timeout allows, and the failure mode
without it is a confusing timeout rather than a clear error.

Remove `--passWithNoTests` from the `test` script.

- [ ] **Step 2: Write the failing Result and Clock tests**

Create `src/shared/types/result.test.ts`:

```ts
import { ok, err, isOk, isErr } from './result'

describe('Result', () => {
  it('narrows an ok value', () => {
    const r = ok(42)
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value).toBe(42)
  })

  it('narrows an err value', () => {
    const r = err('nope' as const)
    expect(isErr(r)).toBe(true)
    if (isErr(r)) expect(r.error).toBe('nope')
  })
})
```

Create `src/shared/time/clock.test.ts`:

```ts
import { fixedClock } from './clock'

describe('fixedClock', () => {
  it('returns the same instant every call', () => {
    const clock = fixedClock('2026-08-26T09:00:00.000Z')
    expect(clock.now().toISOString()).toBe('2026-08-26T09:00:00.000Z')
    expect(clock.now().toISOString()).toBe('2026-08-26T09:00:00.000Z')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './result'` and `'./clock'`.

- [ ] **Step 4: Implement the shared kernel**

Create `src/shared/types/brand.ts`:

```ts
declare const brand: unique symbol

export type Brand<T, B extends string> = T & { readonly [brand]: B }
```

Create `src/shared/types/result.ts`:

```ts
export type Ok<T> = { readonly kind: 'ok'; readonly value: T }
export type Err<E> = { readonly kind: 'err'; readonly error: E }
export type Result<T, E> = Ok<T> | Err<E>

export const ok = <T>(value: T): Ok<T> => ({ kind: 'ok', value })
export const err = <E>(error: E): Err<E> => ({ kind: 'err', error })
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.kind === 'ok'
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r.kind === 'err'
```

Create `src/shared/time/clock.ts`:

```ts
export type Clock = { now: () => Date }

export const systemClock: Clock = { now: () => new Date() }

/** Test double. "This week" and ISO week boundaries depend on the clock, so a
 *  test that cannot fix the date fails one Sunday in seven. */
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) })
```

Note `systemClock` is a value, not a module-level singleton service — it is
passed in explicitly by every consumer, never imported inside domain code.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 6: Create the theme tokens**

Create `src/shared/theme/tokens.ts`. Names are semantic so the undesigned dark
theme is a value swap:

```ts
export const tokens = {
  color: {
    surface: '#F7F2E9',
    surfaceSunken: '#EDE6D9',
    surfaceRaised: '#FFFFFF',
    surfaceInset: '#EFE8DA',
    textPrimary: '#24211C',
    textMuted: '#6B6459',
    rule: '#DBD2C1',
    action: '#C05A38',
    actionPressed: '#9C4529',
    affirm: '#5F7355',
    backlog: '#E8B04B',
  },
  type: {
    display: { fontFamily: 'InstrumentSerif', fontSize: 34 },
    mealName: { fontFamily: 'InstrumentSans', fontWeight: '600', fontSize: 17 },
    body: { fontFamily: 'InstrumentSans', fontWeight: '400', fontSize: 15 },
    shoppingRow: { fontFamily: 'InstrumentSans', fontWeight: '400', fontSize: 19 },
    label: { fontFamily: 'InstrumentSans', fontWeight: '600', fontSize: 12, letterSpacing: 1.4 },
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
} as const
```

`color.backlog` is amber and is used by the Backlog card and nothing else.

- [ ] **Step 7: Wire i18n with both locales**

```bash
npm install i18next react-i18next expo-localization
npm install -D eslint-plugin-i18next
```

Create `src/shared/i18n/locales/en.json`:

```json
{
  "board": { "thisWeek": "This week", "today": "Today", "addMeal": "Add a meal" },
  "slot": { "lunch": "Lunch", "dinner": "Dinner" },
  "cookEvent": { "cookingCount": "Cooking {{count}}" },
  "auth": { "signIn": "Sign in", "email": "Email address" }
}
```

Create `src/shared/i18n/locales/fi.json`:

```json
{
  "board": { "thisWeek": "Tämä viikko", "today": "Tänään", "addMeal": "Lisää ateria" },
  "slot": { "lunch": "Lounas", "dinner": "Päivällinen" },
  "cookEvent": { "cookingCount": "Valmistetaan {{count}}" },
  "auth": { "signIn": "Kirjaudu sisään", "email": "Sähköpostiosoite" }
}
```

Create `src/shared/i18n/index.ts`:

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'
import en from './locales/en.json'
import fi from './locales/fi.json'

const deviceLocale = getLocales()[0]?.languageCode === 'fi' ? 'fi' : 'en'

export const initI18n = (): typeof i18n => {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, fi: { translation: fi } },
    lng: deviceLocale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
  return i18n
}

export { useTranslation } from 'react-i18next'
```

Device locale is only the initial guess. Locale is a Household setting
(ADR 0009) and overrides this once a Household is loaded, in Task 6.

Add the literal-string rule to `eslint.config.mjs`, scoped to UI files:

```js
{
  files: ['src/**/ui/**/*.tsx', 'src/app/**/*.tsx'],
  plugins: { i18next: (await import('eslint-plugin-i18next')).default },
  rules: { 'i18next/no-literal-string': ['error', { markupOnly: true }] },
}
```

- [ ] **Step 8: Create the logger**

Create `src/shared/logger/logger.ts`:

```ts
type Level = 'debug' | 'info' | 'warn' | 'error'
type Context = Record<string, string | number | boolean | undefined>

/** Personal data never reaches logs: Meal names and Member display names imply
 *  religion, health and household composition (docs/06-security.md). Redaction
 *  lives here rather than at call sites so it cannot be forgotten. */
const REDACTED_KEYS = new Set(['mealName', 'displayName', 'email', 'name'])

const redact = (context: Context): Context =>
  Object.fromEntries(
    Object.entries(context).map(([k, v]) => [k, REDACTED_KEYS.has(k) ? '[redacted]' : v]),
  )

export type Logger = { log: (level: Level, event: string, context?: Context) => void }

export const createLogger = (correlationId: string): Logger => ({
  log: (level, event, context = {}) => {
    // eslint-disable-next-line no-console -- the single permitted console call
    console[level === 'debug' ? 'log' : level](
      JSON.stringify({ level, event, correlationId, ...redact(context) }),
    )
  },
})
```

- [ ] **Step 9: Run validate and commit**

Run: `npm run validate`
Expected: PASS.

```bash
git add -A
git commit -m "feat(shared): branded types, Result, clock port, theme tokens, i18n and logger"
```

---

### Task 4: Database foundation — Household, Member, RLS, and the pglite harness

**Files:**
- Create: `supabase/schemas/00_extensions.sql`, `supabase/schemas/10_household.sql`,
  `supabase/schemas/90_policies_household.sql`
- Create: `src/test/db/harness.ts`, `src/test/db/auth-shim.sql`
- Test: `src/test/db/rls-household.test.ts`

**Interfaces:**
- Consumes: Jest node project from Task 3
- Produces: `createTestDb(): Promise<TestDb>` where
  `TestDb = { sql: (query: string, params?: unknown[]) => Promise<unknown[]>, asMember: (userId: string) => Promise<void>, close: () => Promise<void> }`.
  Every later RLS test uses this.

- [ ] **Step 1: Write the schema**

Create `supabase/schemas/00_extensions.sql`:

```sql
create extension if not exists "pgcrypto";
create schema if not exists app;
```

Create `supabase/schemas/10_household.sql`:

```sql
create table household (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  locale text not null default 'fi' check (locale in ('fi', 'en')),
  slots jsonb not null default '[{"key":"lunch","label":"lunch"},{"key":"dinner","label":"dinner"}]'::jsonb,
  created_at timestamptz not null default now()
);

create table household_member (
  household_id uuid not null references household(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null check (length(display_name) between 1 and 40),
  avatar_url text,
  colour text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_member_user_idx on household_member (user_id);
```

`slots` stores label *keys*, not display text — the label is translated in the
UI (ADR 0009). Storing "Lounas" here would make the board monolingual.

- [ ] **Step 2: Write the RLS policies**

Create `supabase/schemas/90_policies_household.sql`:

```sql
-- SECURITY DEFINER so the membership lookup is not subject to the policy it
-- supports, which would recurse.
create or replace function app.is_member(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from household_member
    where household_id = h and user_id = auth.uid()
  );
$fn$;

alter table household enable row level security;
alter table household_member enable row level security;

create policy household_select on household
  for select using (app.is_member(id));

create policy household_update on household
  for update using (app.is_member(id)) with check (app.is_member(id));

create policy household_member_select on household_member
  for select using (app.is_member(household_id));

create policy household_member_insert on household_member
  for insert with check (
    app.is_member(household_id)
    or not exists (select 1 from household_member where household_id = household_member.household_id)
  );
```

The `insert` policy's second branch lets the first Member of a brand-new
Household create their own membership. Without it, creating a Household is
impossible: nobody is a member yet, so `app.is_member` is false for everyone.

- [ ] **Step 3: Write the pglite harness with the auth shim**

```bash
npm install -D @electric-sql/pglite
```

Create `src/test/db/auth-shim.sql`. This is the one knowing divergence from
production (ADR 0007):

```sql
create schema if not exists auth;

-- pglite has no Supabase auth layer. Production resolves auth.uid() from the
-- verified JWT; here it reads a session-local setting that tests control.
create or replace function auth.uid()
returns uuid
language sql
stable
as $fn$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$fn$;
```

Create `src/test/db/harness.ts`:

```ts
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type TestDb = {
  sql: (query: string, params?: unknown[]) => Promise<unknown[]>
  asMember: (userId: string) => Promise<void>
  close: () => Promise<void>
}

const SCHEMA_FILES = [
  'supabase/schemas/00_extensions.sql',
  'supabase/schemas/10_household.sql',
  'src/test/db/auth-shim.sql',
  'supabase/schemas/90_policies_household.sql',
]

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

export const createTestDb = async (): Promise<TestDb> => {
  const db = new PGlite()
  for (const file of SCHEMA_FILES) await db.exec(read(file))

  // Policies do not apply to the table owner; tests must run as a role that
  // is subject to them, exactly as the anon/authenticated roles are in
  // production.
  await db.exec(`
    create role authenticated nologin;
    grant usage on schema public, app to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema app to authenticated;
  `)

  return {
    sql: async (query, params = []) => (await db.query(query, params)).rows,
    asMember: async (userId) => {
      await db.exec(`set role authenticated;`)
      await db.query(`select set_config('app.current_user_id', $1, false)`, [userId])
    },
    close: () => db.close(),
  }
}
```

The auth shim is loaded *before* the policy file because `app.is_member` calls
`auth.uid()` and the function must exist first.

- [ ] **Step 4: Write the failing adversarial RLS test**

Create `src/test/db/rls-household.test.ts`. Note what is being asserted: not
that a Member can read their own Household, which proves nothing, but that they
cannot reach another's.

```ts
import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('household RLS', () => {
  let db: TestDb
  let aliceHousehold: string
  let bobHousehold: string

  beforeAll(async () => {
    db = await createTestDb()
    const seed = async (name: string, userId: string): Promise<string> => {
      const [row] = (await db.sql(
        `insert into household (name) values ($1) returning id`,
        [name],
      )) as { id: string }[]
      await db.sql(
        `insert into household_member (household_id, user_id, role, display_name, colour)
         values ($1, $2, 'owner', 'Owner', '#5F7355')`,
        [row!.id, userId],
      )
      return row!.id
    }
    aliceHousehold = await seed('Alice household', ALICE)
    bobHousehold = await seed('Bob household', BOB)
  })

  afterAll(async () => { await db.close() })

  it('lets a Member read their own Household', async () => {
    await db.asMember(ALICE)
    const rows = await db.sql(`select id from household`)
    expect(rows).toHaveLength(1)
    expect((rows[0] as { id: string }).id).toBe(aliceHousehold)
  })

  it('hides another Household entirely', async () => {
    await db.asMember(ALICE)
    const rows = await db.sql(`select id from household where id = $1`, [bobHousehold])
    expect(rows).toHaveLength(0)
  })

  it('refuses to update another Household', async () => {
    await db.asMember(ALICE)
    await db.sql(`update household set name = 'stolen' where id = $1`, [bobHousehold])
    await db.asMember(BOB)
    const rows = (await db.sql(`select name from household where id = $1`, [bobHousehold])) as { name: string }[]
    expect(rows[0]!.name).toBe('Bob household')
  })

  it('hides another Household\'s Members', async () => {
    await db.asMember(ALICE)
    const rows = await db.sql(`select user_id from household_member where household_id = $1`, [bobHousehold])
    expect(rows).toHaveLength(0)
  })

  it('leaves a Household unreachable once membership is removed', async () => {
    const [row] = (await db.sql(`insert into household (name) values ('Temp') returning id`)) as { id: string }[]
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Temp', '#C05A38')`,
      [row!.id, ALICE],
    )
    await db.sql(`delete from household_member where household_id = $1`, [row!.id])
    await db.asMember(ALICE)
    const rows = await db.sql(`select id from household where id = $1`, [row!.id])
    expect(rows).toHaveLength(0)
  })
})
```

The seeding inserts run before any `set role`, as the owner, deliberately —
policies do not apply to the table owner, which is how the fixtures get created
at all.

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- rls-household`
Expected: FAIL — `supabase/schemas/00_extensions.sql` not found, or policies
missing, depending on which files you have created so far.

- [ ] **Step 6: Make it pass**

Create the SQL files from Steps 1–3 if any are still missing, then re-run.

Run: `npm test -- rls-household`
Expected: PASS, 5 tests.

If the "hides another Household" test fails by returning a row, the most likely
cause is that `set role authenticated` did not take effect — confirm `asMember`
is awaited.

- [ ] **Step 7: Run validate and commit**

```bash
npm run validate
git add -A
git commit -m "feat(household): Household and Member schema with row-level security

- app.is_member SECURITY DEFINER helper avoids policy recursion
- pglite harness with auth.uid() shim for integration tests (ADR 0007)
- RLS tests assert cross-Household access is refused, not that own access works"
```

---

### Task 5: Auth and the Household slice

**Files:**
- Create: `src/features/household/domain/types.ts`,
  `src/features/household/domain/slot.ts`,
  `src/features/household/application/session.ts`,
  `src/features/household/infrastructure/supabase-client.ts`,
  `src/features/household/infrastructure/household-repository.ts`,
  `src/features/household/ui/SessionProvider.tsx`,
  `src/features/household/index.ts`
- Create: `src/shared/env.ts`, `.env.example`
- Test: `src/features/household/domain/slot.test.ts`

**Interfaces:**
- Consumes: `Brand` (Task 3), `Result` (Task 3), `createTestDb` (Task 4)
- Produces:
  - `type HouseholdId = Brand<string, 'HouseholdId'>`, `MemberId`, `SlotKey`
  - `type Slot = { key: SlotKey; labelKey: string }`
  - `type Household = { id: HouseholdId; name: string; locale: 'fi' | 'en'; slots: readonly Slot[] }`
  - `parseSlots(input: unknown): Result<readonly Slot[], 'invalid-slots'>`
  - `createSupabaseClient(env: Env): SupabaseClient`
  - `useSession(): { household: Household | undefined; memberId: MemberId | undefined }`

- [ ] **Step 1: Write the failing Slot test**

Create `src/features/household/domain/slot.test.ts`:

```ts
import { parseSlots } from './slot'
import { isOk, isErr } from '@/shared/types/result'

describe('parseSlots', () => {
  it('accepts the default lunch and dinner Slots', () => {
    const result = parseSlots([
      { key: 'lunch', labelKey: 'slot.lunch' },
      { key: 'dinner', labelKey: 'slot.dinner' },
    ])
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.map((s) => s.key)).toEqual(['lunch', 'dinner'])
  })

  it('rejects a Slot list with a duplicate key', () => {
    const result = parseSlots([
      { key: 'lunch', labelKey: 'slot.lunch' },
      { key: 'lunch', labelKey: 'slot.lunch' },
    ])
    expect(isErr(result)).toBe(true)
  })

  it('rejects a non-array', () => {
    expect(isErr(parseSlots('lunch,dinner'))).toBe(true)
  })

  it('preserves order, because the board renders Slots in configured order', () => {
    const result = parseSlots([
      { key: 'dinner', labelKey: 'slot.dinner' },
      { key: 'lunch', labelKey: 'slot.lunch' },
    ])
    if (isOk(result)) expect(result.value.map((s) => s.key)).toEqual(['dinner', 'lunch'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- slot`
Expected: FAIL — `Cannot find module './slot'`.

- [ ] **Step 3: Implement the domain types**

Create `src/features/household/domain/types.ts`:

```ts
import type { Brand } from '@/shared/types/brand'

export type HouseholdId = Brand<string, 'HouseholdId'>
export type MemberId = Brand<string, 'MemberId'>
export type SlotKey = Brand<string, 'SlotKey'>
export type Locale = 'fi' | 'en'

export type Slot = { readonly key: SlotKey; readonly labelKey: string }

export type Household = {
  readonly id: HouseholdId
  readonly name: string
  readonly locale: Locale
  readonly slots: readonly Slot[]
}

export type Member = {
  readonly id: MemberId
  readonly householdId: HouseholdId
  readonly displayName: string
  readonly colour: string
  readonly avatarUrl?: string
}
```

Create `src/features/household/domain/slot.ts`:

```ts
import { z } from 'zod'
import { ok, err, type Result } from '@/shared/types/result'
import type { Slot, SlotKey } from './types'

const slotSchema = z.array(
  z.object({ key: z.string().min(1).max(24), labelKey: z.string().min(1) }),
)

export type ParseSlotsError = 'invalid-slots'

export const parseSlots = (input: unknown): Result<readonly Slot[], ParseSlotsError> => {
  const parsed = slotSchema.safeParse(input)
  if (!parsed.success) return err('invalid-slots')

  const keys = parsed.data.map((s) => s.key)
  if (new Set(keys).size !== keys.length) return err('invalid-slots')

  return ok(parsed.data.map((s) => ({ key: s.key as SlotKey, labelKey: s.labelKey })))
}
```

Install Zod first: `npm install zod`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- slot`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add validated environment and the Supabase client factory**

Create `src/shared/env.ts`:

```ts
import { z } from 'zod'

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

/** Fails loudly at startup rather than producing an undefined URL at the first
 *  query. Both values are public by construction (docs/06-security.md); the
 *  service role key is never read here. */
export const readEnv = (source: Record<string, string | undefined>): Env =>
  envSchema.parse(source)
```

Create `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create `src/features/household/infrastructure/supabase-client.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '@/shared/env'

/** A factory, not a module-level singleton — the client is injected through
 *  SessionProvider so tests can supply their own. */
export const createSupabaseClient = (env: Env): SupabaseClient =>
  createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
```

Install: `npm install @supabase/supabase-js @react-native-async-storage/async-storage`.

- [ ] **Step 6: Write the Household repository**

Create `src/features/household/infrastructure/household-repository.ts`:

```ts
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ok, err, isErr, type Result } from '@/shared/types/result'
import { parseSlots } from '../domain/slot'
import type { Household, HouseholdId } from '../domain/types'

const rowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  locale: z.enum(['fi', 'en']),
  slots: z.unknown(),
})

export type LoadHouseholdError = 'not-found' | 'invalid-row'

export const loadHousehold = async (
  client: SupabaseClient,
): Promise<Result<Household, LoadHouseholdError>> => {
  const { data } = await client.from('household').select('id,name,locale,slots').limit(1).maybeSingle()
  if (data === null) return err('not-found')

  const row = rowSchema.safeParse(data)
  if (!row.success) return err('invalid-row')

  const slots = parseSlots(row.data.slots)
  if (isErr(slots)) return err('invalid-row')

  return ok({
    id: row.data.id as HouseholdId,
    name: row.data.name,
    locale: row.data.locale,
    slots: slots.value,
  })
}
```

There is no `where household_id = ...` clause and that is deliberate: RLS
already restricts the row set to the Member's own Household (ADR 0002). Adding a
filter here would be a second authorization point.

- [ ] **Step 7: Create the session provider and the feature barrel**

Create `src/features/household/ui/SessionProvider.tsx`:

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Household, MemberId } from '../domain/types'

type SessionValue = {
  readonly client: SupabaseClient
  readonly household: Household | undefined
  readonly memberId: MemberId | undefined
}

const SessionContext = createContext<SessionValue | undefined>(undefined)

export const SessionProvider = ({
  client,
  household,
  memberId,
  children,
}: SessionValue & { children: ReactNode }): React.JSX.Element => {
  const value = useMemo(
    () => ({ client, household, memberId }),
    [client, household, memberId],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = (): SessionValue => {
  const value = useContext(SessionContext)
  if (value === undefined) throw new Error('useSession used outside SessionProvider')
  return value
}
```

Create `src/features/household/index.ts` — the only surface other features may
import:

```ts
export type { Household, HouseholdId, Member, MemberId, Slot, SlotKey, Locale } from './domain/types'
export { parseSlots } from './domain/slot'
export { createSupabaseClient } from './infrastructure/supabase-client'
export { loadHousehold } from './infrastructure/household-repository'
export { SessionProvider, useSession } from './ui/SessionProvider'
```

- [ ] **Step 8: Run validate and commit**

```bash
npm run validate
git add -A
git commit -m "feat(household): Household domain, Supabase client factory and session provider"
```

---

### Task 6: Meals schema and the Meal slice

**Files:**
- Create: `supabase/schemas/20_meals.sql`, `supabase/schemas/91_policies_meals.sql`
- Create: `src/features/meals/domain/types.ts`,
  `src/features/meals/infrastructure/meal-repository.ts`,
  `src/features/meals/ui/MealCard.tsx`,
  `src/features/meals/ui/MealCard.stories.tsx`,
  `src/features/meals/index.ts`
- Modify: `src/test/db/harness.ts` (add the new schema files)
- Test: `src/test/db/rls-meals.test.ts`, `src/features/meals/ui/MealCard.test.tsx`

**Interfaces:**
- Consumes: `HouseholdId` (Task 5), `tokens` (Task 3)
- Produces:
  - `type MealId`, `IngredientId`, `Servings`, `Quantity`
  - `type Meal = { id: MealId; householdId?: HouseholdId; name: string; servings: Servings; photoUrl?: string }`
  - `<MealCard variant="library" | "backlog" | "planned" | "leftover" ... />`

- [ ] **Step 1: Write the Meal and Ingredient schema**

Create `supabase/schemas/20_meals.sql`:

```sql
create table ingredient (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references household(id) on delete cascade,
  slug text not null,
  category text not null,
  dimension text not null check (dimension in ('mass', 'volume', 'count')),
  base_unit text not null,
  unique (household_id, slug)
);

-- Identity is the slug, never a name: a Finnish Household's "sipuli" and an
-- English Catalogue Meal's "onion" must aggregate to one Buy Line (ADR 0009).
create table ingredient_name (
  ingredient_id uuid not null references ingredient(id) on delete cascade,
  locale text not null check (locale in ('fi', 'en')),
  name text not null,
  primary key (ingredient_id, locale)
);

create table meal (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references household(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  servings integer not null default 4 check (servings between 1 and 50),
  source_url text,
  photo_url text,
  copied_from_meal_id uuid references meal(id) on delete set null,
  created_at timestamptz not null default now()
);

create index meal_household_idx on meal (household_id);

create table meal_ingredient (
  meal_id uuid not null references meal(id) on delete cascade,
  ingredient_id uuid not null references ingredient(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  optional boolean not null default false,
  primary key (meal_id, ingredient_id)
);
```

A Meal with no `meal_ingredient` rows is legal — the day-one quick-add path
creates exactly that, and the Shopping List surfaces it as an incomplete-Meal
line rather than silently omitting it.

- [ ] **Step 2: Write the Meal policies**

Create `supabase/schemas/91_policies_meals.sql`:

```sql
alter table ingredient enable row level security;
alter table ingredient_name enable row level security;
alter table meal enable row level security;
alter table meal_ingredient enable row level security;

-- Catalogue rows (household_id is null) are world-readable and writable by
-- nobody through the client; the sync script uses the service role.
create policy ingredient_select on ingredient
  for select using (household_id is null or app.is_member(household_id));

create policy ingredient_write on ingredient
  for all using (household_id is not null and app.is_member(household_id))
  with check (household_id is not null and app.is_member(household_id));

create policy ingredient_name_select on ingredient_name
  for select using (exists (
    select 1 from ingredient i where i.id = ingredient_id
      and (i.household_id is null or app.is_member(i.household_id))
  ));

create policy meal_select on meal
  for select using (household_id is null or app.is_member(household_id));

create policy meal_write on meal
  for all using (household_id is not null and app.is_member(household_id))
  with check (household_id is not null and app.is_member(household_id));

create policy meal_ingredient_select on meal_ingredient
  for select using (exists (
    select 1 from meal m where m.id = meal_id
      and (m.household_id is null or app.is_member(m.household_id))
  ));

create policy meal_ingredient_write on meal_ingredient
  for all using (exists (
    select 1 from meal m where m.id = meal_id
      and m.household_id is not null and app.is_member(m.household_id)
  ))
  with check (exists (
    select 1 from meal m where m.id = meal_id
      and m.household_id is not null and app.is_member(m.household_id)
  ));
```

- [ ] **Step 3: Write the failing Meal RLS test**

Add `'supabase/schemas/20_meals.sql'` and `'supabase/schemas/91_policies_meals.sql'`
to `SCHEMA_FILES` in `src/test/db/harness.ts`, ordered after `10_household.sql`
and after the auth shim respectively.

Create `src/test/db/rls-meals.test.ts`:

```ts
import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('meal RLS', () => {
  let db: TestDb
  let aliceHousehold: string
  let bobMeal: string
  let catalogueMeal: string

  beforeAll(async () => {
    db = await createTestDb()
    const seedHousehold = async (name: string, userId: string): Promise<string> => {
      const [h] = (await db.sql(`insert into household (name) values ($1) returning id`, [name])) as { id: string }[]
      await db.sql(
        `insert into household_member (household_id, user_id, role, display_name, colour)
         values ($1, $2, 'owner', 'Owner', '#5F7355')`,
        [h!.id, userId],
      )
      return h!.id
    }
    aliceHousehold = await seedHousehold('Alice household', ALICE)
    const bobHousehold = await seedHousehold('Bob household', BOB)

    const [bm] = (await db.sql(
      `insert into meal (household_id, name, servings) values ($1, 'Bob chili', 4) returning id`,
      [bobHousehold],
    )) as { id: string }[]
    bobMeal = bm!.id

    const [cm] = (await db.sql(
      `insert into meal (household_id, name, servings) values (null, 'Shakshuka', 2) returning id`,
    )) as { id: string }[]
    catalogueMeal = cm!.id
  })

  afterAll(async () => { await db.close() })

  it('hides another Household\'s Meal', async () => {
    await db.asMember(ALICE)
    const rows = await db.sql(`select id from meal where id = $1`, [bobMeal])
    expect(rows).toHaveLength(0)
  })

  it('shows Catalogue Meals to everyone', async () => {
    await db.asMember(ALICE)
    const rows = await db.sql(`select id from meal where id = $1`, [catalogueMeal])
    expect(rows).toHaveLength(1)
  })

  it('refuses to let a Household edit a Catalogue Meal', async () => {
    await db.asMember(ALICE)
    await db.sql(`update meal set name = 'hijacked' where id = $1`, [catalogueMeal])
    const rows = (await db.sql(`select name from meal where id = $1`, [catalogueMeal])) as { name: string }[]
    expect(rows[0]!.name).toBe('Shakshuka')
  })

  it('allows a Meal with no Ingredients, for the day-one quick-add path', async () => {
    await db.asMember(ALICE)
    await db.sql(
      `insert into meal (household_id, name, servings) values ($1, 'Tacos', 4)`,
      [aliceHousehold],
    )
    const rows = (await db.sql(
      `select m.name, count(mi.ingredient_id) as ingredient_count
       from meal m left join meal_ingredient mi on mi.meal_id = m.id
       where m.name = 'Tacos' group by m.name`,
    )) as { name: string; ingredient_count: string }[]
    expect(rows[0]!.ingredient_count).toBe('0')
  })
})
```

- [ ] **Step 4: Run to verify it fails, then passes**

Run: `npm test -- rls-meals`
Expected first: FAIL — relation "meal" does not exist.

Create the two SQL files, add them to `SCHEMA_FILES`, re-run.

Run: `npm test -- rls-meals`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the Meal domain types**

Create `src/features/meals/domain/types.ts`:

```ts
import type { Brand } from '@/shared/types/brand'
import type { HouseholdId } from '@/features/household'

export type MealId = Brand<string, 'MealId'>
export type IngredientId = Brand<string, 'IngredientId'>
export type IngredientSlug = Brand<string, 'IngredientSlug'>
export type Servings = Brand<number, 'Servings'>
export type Quantity = Brand<number, 'Quantity'>

export type Meal = {
  readonly id: MealId
  readonly householdId?: HouseholdId
  readonly name: string
  readonly servings: Servings
  readonly photoUrl?: string
}

export const isCatalogueMeal = (meal: Meal): boolean => meal.householdId === undefined
```

`Servings` and `Quantity` are branded for the same reason ids are: `scale(q, s)`
taking two bare numbers is the bug that puts four kilos of onions on a list.

- [ ] **Step 6: Write the failing MealCard test**

Create `src/features/meals/ui/MealCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { MealCard } from './MealCard'
import type { MealId, Servings } from '../domain/types'

const meal = { id: 'm1' as MealId, name: 'Chili con carne', servings: 4 as Servings }

describe('MealCard', () => {
  it('shows the Meal name in every variant', () => {
    render(<MealCard meal={meal} variant="library" />)
    expect(screen.getByText('Chili con carne')).toBeTruthy()
  })

  it('shows a serif initial when the Meal has no photo', () => {
    render(<MealCard meal={meal} variant="library" />)
    expect(screen.getByTestId('meal-card-initial')).toBeTruthy()
  })

  it('shows the adder on a backlog card, because who wants it is the point', () => {
    render(<MealCard meal={meal} variant="backlog" addedBy="Dad" />)
    expect(screen.getByText('Dad')).toBeTruthy()
  })

  it('renders a long Finnish compound name without crashing', () => {
    const long = { ...meal, name: 'Uunilohi ja perunamuusi kermaviilikastikkeella' }
    render(<MealCard meal={long} variant="planned" servingsCooked={6 as Servings} />)
    expect(screen.getByText(long.name)).toBeTruthy()
  })
})
```

Install: `npm install -D @testing-library/react-native react-test-renderer`.

- [ ] **Step 7: Run to verify it fails**

Run: `npm test -- MealCard`
Expected: FAIL — `Cannot find module './MealCard'`.

- [ ] **Step 8: Implement MealCard**

Create `src/features/meals/ui/MealCard.tsx`. Four variants, distinct
components internally, one exported entry point — the silhouette carries the
difference before the text does:

```tsx
import { Image, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import type { Meal, Servings } from '../domain/types'

export type MealCardVariant = 'library' | 'backlog' | 'planned' | 'leftover'

type Props = {
  readonly meal: Meal
  readonly variant: MealCardVariant
  readonly addedBy?: string
  readonly servingsCooked?: Servings
  readonly parentMealName?: string
}

const styles = StyleSheet.create({
  base: { borderRadius: 10, padding: tokens.space.md, gap: tokens.space.xs },
  library: { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: tokens.color.rule },
  backlog: { backgroundColor: tokens.color.surfaceRaised, borderLeftWidth: 3, borderLeftColor: tokens.color.backlog },
  planned: { backgroundColor: tokens.color.surfaceRaised, shadowOpacity: 0.06, shadowRadius: 6 },
  leftover: { backgroundColor: tokens.color.surfaceInset, borderWidth: 1, borderStyle: 'dashed', borderColor: tokens.color.rule },
  name: { ...tokens.type.mealName, color: tokens.color.textPrimary },
  support: { ...tokens.type.body, color: tokens.color.textMuted },
  initial: { ...tokens.type.display, fontSize: 20, color: tokens.color.textMuted },
  chip: { width: 46, height: 46, borderRadius: 6 },
})

export const MealCard = ({
  meal, variant, addedBy, servingsCooked, parentMealName,
}: Props): React.JSX.Element => (
  <View style={[styles.base, styles[variant]]} testID={`meal-card-${variant}`}>
    <View style={{ flexDirection: 'row', gap: tokens.space.sm, alignItems: 'center' }}>
      {meal.photoUrl === undefined ? (
        <Text style={styles.initial} testID="meal-card-initial">
          {meal.name.slice(0, 1).toUpperCase()}
        </Text>
      ) : (
        <Image source={{ uri: meal.photoUrl }} style={styles.chip} accessibilityIgnoresInvertColors />
      )}
      <Text style={styles.name} numberOfLines={2}>
        {variant === 'leftover' && parentMealName !== undefined ? parentMealName : meal.name}
      </Text>
    </View>
    {addedBy !== undefined && <Text style={styles.support}>{addedBy}</Text>}
    {servingsCooked !== undefined && (
      <Text style={styles.support} testID="meal-card-servings-cooked">{String(servingsCooked)}</Text>
    )}
  </View>
)
```

The bare `servingsCooked` number is a placeholder rendering; Task 9 replaces it
with the translated `cookEvent.cookingCount` string. It is left untranslated
here so this task's tests do not depend on i18n initialisation.

- [ ] **Step 9: Run to verify it passes**

Run: `npm test -- MealCard`
Expected: PASS, 4 tests.

- [ ] **Step 10: Add Storybook and the MealCard stories**

```bash
npm install -D storybook @storybook/react-native-web-vite vite
npm run storybook -- --help || true
```

Add script: `"storybook": "storybook dev -p 6006"`.

Create `src/features/meals/ui/MealCard.stories.tsx` covering every state named
in `docs/05-code-quality.md`:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { MealCard } from './MealCard'
import type { MealId, Servings } from '../domain/types'

const meal = { id: 'm1' as MealId, name: 'Chili con carne', servings: 4 as Servings }
const longName = { ...meal, name: 'Uunilohi ja perunamuusi kermaviilikastikkeella' }
const withPhoto = { ...meal, photoUrl: 'https://placehold.co/92x92' }

const meta: Meta<typeof MealCard> = { component: MealCard, title: 'Meals/MealCard' }
export default meta
type Story = StoryObj<typeof MealCard>

export const Library: Story = { args: { meal, variant: 'library' } }
export const LibraryWithPhoto: Story = { args: { meal: withPhoto, variant: 'library' } }
export const Backlog: Story = { args: { meal, variant: 'backlog', addedBy: 'Dad' } }
export const Planned: Story = { args: { meal, variant: 'planned', servingsCooked: 6 as Servings } }
export const Leftover: Story = { args: { meal, variant: 'leftover', parentMealName: 'Chili — leftovers' } }
export const LongFinnishName: Story = { args: { meal: longName, variant: 'planned', servingsCooked: 4 as Servings } }
```

- [ ] **Step 11: Create the feature barrel, validate and commit**

Create `src/features/meals/index.ts`:

```ts
export type { Meal, MealId, IngredientId, IngredientSlug, Servings, Quantity } from './domain/types'
export { isCatalogueMeal } from './domain/types'
export { MealCard, type MealCardVariant } from './ui/MealCard'
```

```bash
npm run validate
git add -A
git commit -m "feat(meals): Meal and Ingredient schema, slug-keyed identity, MealCard with stories

- Ingredient identity is a locale-independent slug (ADR 0009)
- Catalogue Meals readable by all, editable by none through the client
- A Meal with no Ingredients is legal, for the day-one quick-add path"
```

---

### Task 7: Planning schema — Week Plan, Backlog Item, Cook Event, Leftover

**Files:**
- Create: `supabase/schemas/30_planning.sql`, `supabase/schemas/92_policies_planning.sql`
- Modify: `src/test/db/harness.ts`
- Test: `src/test/db/rls-planning.test.ts`

**Interfaces:**
- Consumes: `app.is_member` (Task 4), `meal` (Task 6)
- Produces: tables `week_plan`, `backlog_item`, `cook_event`, `leftover`

- [ ] **Step 1: Write the schema**

Create `supabase/schemas/30_planning.sql`:

```sql
create table week_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  week_start date not null,
  unique (household_id, week_start),
  -- ISO weeks start on Monday. extract(isodow) returns 1 for Monday.
  constraint week_start_is_monday check (extract(isodow from week_start) = 1)
);

create table backlog_item (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references week_plan(id) on delete cascade,
  meal_id uuid not null references meal(id) on delete cascade,
  added_by uuid not null,
  created_at timestamptz not null default now()
);

create table cook_event (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references week_plan(id) on delete cascade,
  meal_id uuid not null references meal(id) on delete cascade,
  date date not null,
  slot_key text not null,
  servings_cooked integer not null check (servings_cooked between 1 and 50),
  from_backlog_item_id uuid,
  created_at timestamptz not null default now()
);

create index cook_event_week_idx on cook_event (week_plan_id, date);

-- No unique constraint on (date, slot_key): two Meals on Tuesday dinner is a
-- supported outcome, not a conflict. Refusing a Member's edit is worse than
-- showing two cards.

create table leftover (
  id uuid primary key default gen_random_uuid(),
  cook_event_id uuid not null references cook_event(id) on delete cascade,
  date date not null,
  slot_key text not null
);

create index leftover_cook_event_idx on leftover (cook_event_id);
```

`leftover` has no `meal_id` and no servings; it borrows both from its Cook
Event. The cascade is what guarantees a Leftover can never be stranded.

`cook_event.slot_key` is deliberately not a foreign key to the Household's
`slots` — Slots are configuration, and removing one must not delete the Meals
planned in it.

- [ ] **Step 2: Write the policies**

Create `supabase/schemas/92_policies_planning.sql`:

```sql
alter table week_plan enable row level security;
alter table backlog_item enable row level security;
alter table cook_event enable row level security;
alter table leftover enable row level security;

create policy week_plan_all on week_plan
  for all using (app.is_member(household_id)) with check (app.is_member(household_id));

create policy backlog_item_all on backlog_item
  for all using (exists (
    select 1 from week_plan w where w.id = week_plan_id and app.is_member(w.household_id)
  ))
  with check (exists (
    select 1 from week_plan w where w.id = week_plan_id and app.is_member(w.household_id)
  ));

create policy cook_event_all on cook_event
  for all using (exists (
    select 1 from week_plan w where w.id = week_plan_id and app.is_member(w.household_id)
  ))
  with check (exists (
    select 1 from week_plan w where w.id = week_plan_id and app.is_member(w.household_id)
  ));

create policy leftover_all on leftover
  for all using (exists (
    select 1 from cook_event c join week_plan w on w.id = c.week_plan_id
    where c.id = cook_event_id and app.is_member(w.household_id)
  ))
  with check (exists (
    select 1 from cook_event c join week_plan w on w.id = c.week_plan_id
    where c.id = cook_event_id and app.is_member(w.household_id)
  ));
```

- [ ] **Step 3: Write the failing planning RLS and cascade test**

Add the two files to `SCHEMA_FILES` in the harness (schema after `20_meals.sql`,
policies after `91_policies_meals.sql`).

Create `src/test/db/rls-planning.test.ts`:

```ts
import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('planning RLS and cascades', () => {
  let db: TestDb
  let aliceWeek: string
  let bobWeek: string
  let aliceMeal: string

  beforeAll(async () => {
    db = await createTestDb()
    const seed = async (name: string, userId: string): Promise<{ household: string; week: string; meal: string }> => {
      const [h] = (await db.sql(`insert into household (name) values ($1) returning id`, [name])) as { id: string }[]
      await db.sql(
        `insert into household_member (household_id, user_id, role, display_name, colour)
         values ($1, $2, 'owner', 'Owner', '#5F7355')`, [h!.id, userId],
      )
      const [w] = (await db.sql(
        `insert into week_plan (household_id, week_start) values ($1, '2026-08-24') returning id`, [h!.id],
      )) as { id: string }[]
      const [m] = (await db.sql(
        `insert into meal (household_id, name, servings) values ($1, 'Chili', 4) returning id`, [h!.id],
      )) as { id: string }[]
      return { household: h!.id, week: w!.id, meal: m!.id }
    }
    const alice = await seed('Alice household', ALICE)
    const bob = await seed('Bob household', BOB)
    aliceWeek = alice.week
    aliceMeal = alice.meal
    bobWeek = bob.week
  })

  afterAll(async () => { await db.close() })

  it('rejects a week_start that is not a Monday', async () => {
    await expect(
      db.sql(`insert into week_plan (household_id, week_start)
              select household_id, '2026-08-25' from week_plan where id = $1`, [aliceWeek]),
    ).rejects.toThrow()
  })

  it('hides another Household\'s Week Plan', async () => {
    await db.asMember(ALICE)
    const rows = await db.sql(`select id from week_plan where id = $1`, [bobWeek])
    expect(rows).toHaveLength(0)
  })

  it('refuses a Cook Event inserted into another Household\'s Week Plan', async () => {
    await db.asMember(ALICE)
    await expect(
      db.sql(
        `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
         values ($1, $2, '2026-08-25', 'dinner', 4)`, [bobWeek, aliceMeal],
      ),
    ).rejects.toThrow()
  })

  it('allows two Cook Events in the same day and Slot', async () => {
    await db.asMember(ALICE)
    for (const _ of [1, 2]) {
      await db.sql(
        `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
         values ($1, $2, '2026-08-25', 'dinner', 4)`, [aliceWeek, aliceMeal],
      )
    }
    const rows = await db.sql(
      `select id from cook_event where week_plan_id = $1 and date = '2026-08-25' and slot_key = 'dinner'`,
      [aliceWeek],
    )
    expect(rows).toHaveLength(2)
  })

  it('takes Leftovers with the Cook Event when it is deleted', async () => {
    await db.asMember(ALICE)
    const [ce] = (await db.sql(
      `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
       values ($1, $2, '2026-08-26', 'dinner', 6) returning id`, [aliceWeek, aliceMeal],
    )) as { id: string }[]
    await db.sql(
      `insert into leftover (cook_event_id, date, slot_key) values ($1, '2026-08-27', 'lunch')`, [ce!.id],
    )
    await db.sql(`delete from cook_event where id = $1`, [ce!.id])
    const rows = await db.sql(`select id from leftover where cook_event_id = $1`, [ce!.id])
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run to verify it fails, then passes**

Run: `npm test -- rls-planning`
Expected first: FAIL — relation "week_plan" does not exist.

Create the SQL files, add them to `SCHEMA_FILES`, re-run.

Run: `npm test -- rls-planning`
Expected: PASS, 5 tests.

- [ ] **Step 5: Validate and commit**

```bash
npm run validate
git add -A
git commit -m "feat(planning): Week Plan, Backlog Item, Cook Event and Leftover schema

- Leftovers cascade from their Cook Event so none can be stranded (ADR 0004)
- No uniqueness on (date, slot_key): two Meals on Tuesday dinner is supported
- week_start constrained to a Monday"
```

---

### Task 8: Planning domain — week resolution and the board model

**Files:**
- Create: `src/features/planning/domain/types.ts`,
  `src/features/planning/domain/week.ts`,
  `src/features/planning/domain/board.ts`,
  `src/features/planning/infrastructure/board-repository.ts`,
  `src/features/planning/index.ts`
- Test: `src/features/planning/domain/week.test.ts`,
  `src/features/planning/domain/board.test.ts`

**Interfaces:**
- Consumes: `Clock` (Task 3), `Slot`, `SlotKey`, `HouseholdId` (Task 5),
  `MealId`, `Servings` (Task 6)
- Produces:
  - `type WeekStart = Brand<string, 'WeekStart'>`, `WeekPlanId`, `CookEventId`, `LeftoverId`
  - `currentWeekStart(clock: Clock): WeekStart`
  - `weekDates(weekStart: WeekStart): readonly string[]` — seven ISO dates
  - `type BoardDay = { date: string; slots: readonly BoardSlot[] }`
  - `type BoardSlot = { slotKey: SlotKey; labelKey: string; cards: readonly BoardCard[] }`
  - `buildBoard(input: BuildBoardInput): readonly BoardDay[]`

- [ ] **Step 1: Write the failing week test**

Create `src/features/planning/domain/week.test.ts`:

```ts
import { fixedClock } from '@/shared/time/clock'
import { currentWeekStart, weekDates } from './week'

describe('currentWeekStart', () => {
  it('returns Monday when today is mid-week', () => {
    expect(currentWeekStart(fixedClock('2026-08-26T09:00:00.000Z'))).toBe('2026-08-24')
  })

  it('returns today when today is Monday', () => {
    expect(currentWeekStart(fixedClock('2026-08-24T00:30:00.000Z'))).toBe('2026-08-24')
  })

  it('returns the Monday six days back when today is Sunday', () => {
    expect(currentWeekStart(fixedClock('2026-08-30T23:59:00.000Z'))).toBe('2026-08-24')
  })
})

describe('weekDates', () => {
  it('returns seven consecutive ISO dates from Monday', () => {
    expect(weekDates('2026-08-24' as never)).toEqual([
      '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27',
      '2026-08-28', '2026-08-29', '2026-08-30',
    ])
  })

  it('crosses a month boundary correctly', () => {
    expect(weekDates('2026-08-31' as never)[6]).toBe('2026-09-06')
  })
})
```

The Sunday case is the one that matters: a naive `getDay()`-based
implementation returns the *next* Monday on Sundays, which silently shows an
empty week to a family planning on Sunday evening — the single most likely
moment they use the app.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- week`
Expected: FAIL — `Cannot find module './week'`.

- [ ] **Step 3: Implement week resolution**

Create `src/features/planning/domain/types.ts`:

```ts
import type { Brand } from '@/shared/types/brand'
import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'

export type WeekStart = Brand<string, 'WeekStart'>
export type WeekPlanId = Brand<string, 'WeekPlanId'>
export type CookEventId = Brand<string, 'CookEventId'>
export type LeftoverId = Brand<string, 'LeftoverId'>
export type BacklogItemId = Brand<string, 'BacklogItemId'>

export type CookEvent = {
  readonly id: CookEventId
  readonly mealId: MealId
  readonly mealName: string
  readonly date: string
  readonly slotKey: SlotKey
  readonly servingsCooked: Servings
}

export type Leftover = {
  readonly id: LeftoverId
  readonly cookEventId: CookEventId
  readonly parentMealName: string
  readonly date: string
  readonly slotKey: SlotKey
}

export type BoardCard =
  | { readonly kind: 'cook-event'; readonly cookEvent: CookEvent }
  | { readonly kind: 'leftover'; readonly leftover: Leftover }
```

Create `src/features/planning/domain/week.ts`:

```ts
import type { Clock } from '@/shared/time/clock'
import type { WeekStart } from './types'

const DAY_MS = 86_400_000

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10)

/** Monday of the ISO week containing the clock's instant. getUTCDay() returns 0
 *  for Sunday, which must map back six days, not forward one. */
export const currentWeekStart = (clock: Clock): WeekStart => {
  const now = clock.now()
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const dayOfWeek = new Date(utcMidnight).getUTCDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7
  return toIsoDate(new Date(utcMidnight - daysSinceMonday * DAY_MS)) as WeekStart
}

export const weekDates = (weekStart: WeekStart): readonly string[] => {
  const start = Date.parse(`${weekStart}T00:00:00.000Z`)
  return Array.from({ length: 7 }, (_, i) => toIsoDate(new Date(start + i * DAY_MS)))
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- week`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing board test**

Create `src/features/planning/domain/board.test.ts`:

```ts
import { buildBoard } from './board'
import type { CookEvent, Leftover, WeekStart } from './types'
import type { Slot, SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import type { CookEventId, LeftoverId } from './types'

const slots: readonly Slot[] = [
  { key: 'lunch' as SlotKey, labelKey: 'slot.lunch' },
  { key: 'dinner' as SlotKey, labelKey: 'slot.dinner' },
]

const cookEvent = (id: string, date: string, slotKey: string): CookEvent => ({
  id: id as CookEventId,
  mealId: 'm1' as MealId,
  mealName: 'Chili con carne',
  date,
  slotKey: slotKey as SlotKey,
  servingsCooked: 6 as Servings,
})

describe('buildBoard', () => {
  const weekStart = '2026-08-24' as WeekStart

  it('returns seven days in order', () => {
    const board = buildBoard({ weekStart, slots, cookEvents: [], leftovers: [] })
    expect(board).toHaveLength(7)
    expect(board[0]!.date).toBe('2026-08-24')
    expect(board[6]!.date).toBe('2026-08-30')
  })

  it('gives every day the Household\'s Slots in configured order', () => {
    const board = buildBoard({ weekStart, slots, cookEvents: [], leftovers: [] })
    expect(board[0]!.slots.map((s) => s.slotKey)).toEqual(['lunch', 'dinner'])
  })

  it('places a Cook Event in its day and Slot', () => {
    const board = buildBoard({
      weekStart, slots, cookEvents: [cookEvent('c1', '2026-08-25', 'dinner')], leftovers: [],
    })
    const tuesdayDinner = board[1]!.slots[1]!
    expect(tuesdayDinner.cards).toHaveLength(1)
    expect(tuesdayDinner.cards[0]!.kind).toBe('cook-event')
  })

  it('keeps two Cook Events in one Slot rather than dropping either', () => {
    const board = buildBoard({
      weekStart, slots,
      cookEvents: [cookEvent('c1', '2026-08-25', 'dinner'), cookEvent('c2', '2026-08-25', 'dinner')],
      leftovers: [],
    })
    expect(board[1]!.slots[1]!.cards).toHaveLength(2)
  })

  it('places a Leftover on its own day and Slot, not its parent\'s', () => {
    const leftover: Leftover = {
      id: 'l1' as LeftoverId,
      cookEventId: 'c1' as CookEventId,
      parentMealName: 'Chili con carne',
      date: '2026-08-26',
      slotKey: 'lunch' as SlotKey,
    }
    const board = buildBoard({
      weekStart, slots, cookEvents: [cookEvent('c1', '2026-08-25', 'dinner')], leftovers: [leftover],
    })
    expect(board[2]!.slots[0]!.cards[0]!.kind).toBe('leftover')
    expect(board[1]!.slots[1]!.cards).toHaveLength(1)
  })

  it('ignores a card whose Slot is no longer configured, without losing the day', () => {
    const board = buildBoard({
      weekStart, slots, cookEvents: [cookEvent('c1', '2026-08-25', 'brunch')], leftovers: [],
    })
    expect(board[1]!.slots.flatMap((s) => s.cards)).toHaveLength(0)
    expect(board[1]!.slots).toHaveLength(2)
  })
})
```

The last test encodes the decision from `docs/03-datamodel.md`: removing a Slot
from the Household config must not delete the Meals planned in it, so the board
tolerates an orphaned `slot_key` rather than crashing.

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- board`
Expected: FAIL — `Cannot find module './board'`.

- [ ] **Step 7: Implement buildBoard**

Create `src/features/planning/domain/board.ts`:

```ts
import type { Slot, SlotKey } from '@/features/household'
import { weekDates } from './week'
import type { BoardCard, CookEvent, Leftover, WeekStart } from './types'

export type BoardSlot = {
  readonly slotKey: SlotKey
  readonly labelKey: string
  readonly cards: readonly BoardCard[]
}

export type BoardDay = { readonly date: string; readonly slots: readonly BoardSlot[] }

export type BuildBoardInput = {
  readonly weekStart: WeekStart
  readonly slots: readonly Slot[]
  readonly cookEvents: readonly CookEvent[]
  readonly leftovers: readonly Leftover[]
}

export const buildBoard = ({
  weekStart, slots, cookEvents, leftovers,
}: BuildBoardInput): readonly BoardDay[] => {
  const cards: readonly (BoardCard & { date: string; slotKey: SlotKey })[] = [
    ...cookEvents.map((cookEvent) => ({
      kind: 'cook-event' as const, cookEvent, date: cookEvent.date, slotKey: cookEvent.slotKey,
    })),
    ...leftovers.map((leftover) => ({
      kind: 'leftover' as const, leftover, date: leftover.date, slotKey: leftover.slotKey,
    })),
  ]

  return weekDates(weekStart).map((date) => ({
    date,
    // Slots that no longer exist in the Household config are skipped, not
    // errors: removing a Slot must never delete the Meals planned in it.
    slots: slots.map((slot) => ({
      slotKey: slot.key,
      labelKey: slot.labelKey,
      cards: cards.filter((c) => c.date === date && c.slotKey === slot.key),
    })),
  }))
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm test -- board`
Expected: PASS, 6 tests.

- [ ] **Step 9: Write the board repository**

Create `src/features/planning/infrastructure/board-repository.ts`:

```ts
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ok, err, type Result } from '@/shared/types/result'
import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import type { CookEvent, CookEventId, Leftover, LeftoverId, WeekStart } from '../domain/types'

const cookEventRow = z.object({
  id: z.string().uuid(),
  meal_id: z.string().uuid(),
  date: z.string(),
  slot_key: z.string(),
  servings_cooked: z.number().int(),
  meal: z.object({ name: z.string() }),
})

const leftoverRow = z.object({
  id: z.string().uuid(),
  cook_event_id: z.string().uuid(),
  date: z.string(),
  slot_key: z.string(),
  cook_event: z.object({ meal: z.object({ name: z.string() }) }),
})

export type LoadWeekError = 'no-week-plan' | 'invalid-row'

export type WeekContents = {
  readonly cookEvents: readonly CookEvent[]
  readonly leftovers: readonly Leftover[]
}

export const loadWeek = async (
  client: SupabaseClient,
  weekStart: WeekStart,
): Promise<Result<WeekContents, LoadWeekError>> => {
  const { data: plan } = await client
    .from('week_plan').select('id').eq('week_start', weekStart).maybeSingle()
  if (plan === null) return err('no-week-plan')

  const planId = (plan as { id: string }).id

  const { data: cookEventData } = await client
    .from('cook_event')
    .select('id,meal_id,date,slot_key,servings_cooked,meal(name)')
    .eq('week_plan_id', planId)

  const { data: leftoverData } = await client
    .from('leftover')
    .select('id,cook_event_id,date,slot_key,cook_event!inner(week_plan_id,meal(name))')
    .eq('cook_event.week_plan_id', planId)

  const cookEvents = z.array(cookEventRow).safeParse(cookEventData ?? [])
  const leftovers = z.array(leftoverRow).safeParse(leftoverData ?? [])
  if (!cookEvents.success || !leftovers.success) return err('invalid-row')

  return ok({
    cookEvents: cookEvents.data.map((r) => ({
      id: r.id as CookEventId,
      mealId: r.meal_id as MealId,
      mealName: r.meal.name,
      date: r.date,
      slotKey: r.slot_key as SlotKey,
      servingsCooked: r.servings_cooked as Servings,
    })),
    leftovers: leftovers.data.map((r) => ({
      id: r.id as LeftoverId,
      cookEventId: r.cook_event_id as CookEventId,
      parentMealName: r.cook_event.meal.name,
      date: r.date,
      slotKey: r.slot_key as SlotKey,
    })),
  })
}
```

- [ ] **Step 10: Create the barrel, validate and commit**

Create `src/features/planning/index.ts`:

```ts
export type {
  WeekStart, WeekPlanId, CookEvent, CookEventId, Leftover, LeftoverId, BacklogItemId, BoardCard,
} from './domain/types'
export { currentWeekStart, weekDates } from './domain/week'
export { buildBoard, type BoardDay, type BoardSlot, type BuildBoardInput } from './domain/board'
export { loadWeek, type WeekContents, type LoadWeekError } from './infrastructure/board-repository'
```

```bash
npm run validate
git add -A
git commit -m "feat(planning): week resolution and board model as pure functions

- currentWeekStart maps Sunday back six days, not forward one
- buildBoard tolerates an orphaned slot_key so removing a Slot loses no Meals"
```

---

### Task 9: The board screen — the tracer bullet

**Files:**
- Create: `src/features/planning/ui/BoardScreen.tsx`,
  `src/features/planning/ui/DayColumn.tsx`,
  `src/features/planning/ui/useWeekBoard.ts`
- Modify: `src/app/_layout.tsx`, `src/app/index.tsx`,
  `src/features/planning/index.ts`, `src/features/meals/ui/MealCard.tsx`
- Test: `src/features/planning/ui/DayColumn.test.tsx`

**Interfaces:**
- Consumes: `buildBoard`, `currentWeekStart`, `loadWeek` (Task 8),
  `MealCard` (Task 6), `useSession` (Task 5), `tokens` and `useTranslation`
  (Task 3)
- Produces: the rendered board. This is the end of the tracer bullet.

- [ ] **Step 1: Translate the servings label in MealCard**

Modify `src/features/meals/ui/MealCard.tsx` — replace the placeholder
`{String(servingsCooked)}` block with the translated string:

```tsx
import { useTranslation } from '@/shared/i18n'
```

and inside the component:

```tsx
const { t } = useTranslation()
```

then:

```tsx
{servingsCooked !== undefined && (
  <Text style={styles.support} testID="meal-card-servings-cooked">
    {t('cookEvent.cookingCount', { count: servingsCooked })}
  </Text>
)}
```

Update the assertion in `src/features/meals/ui/MealCard.test.tsx` that referenced
the raw number — it now reads:

```tsx
expect(screen.getByTestId('meal-card-servings-cooked')).toBeTruthy()
```

- [ ] **Step 2: Write the failing DayColumn test**

Create `src/features/planning/ui/DayColumn.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { DayColumn } from './DayColumn'
import type { BoardDay } from '../domain/board'
import type { CookEventId } from '../domain/types'
import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'

const emptyDay: BoardDay = {
  date: '2026-08-24',
  slots: [
    { slotKey: 'lunch' as SlotKey, labelKey: 'slot.lunch', cards: [] },
    { slotKey: 'dinner' as SlotKey, labelKey: 'slot.dinner', cards: [] },
  ],
}

const dayWithTwoDinners: BoardDay = {
  date: '2026-08-25',
  slots: [
    { slotKey: 'lunch' as SlotKey, labelKey: 'slot.lunch', cards: [] },
    {
      slotKey: 'dinner' as SlotKey,
      labelKey: 'slot.dinner',
      cards: [1, 2].map((n) => ({
        kind: 'cook-event' as const,
        cookEvent: {
          id: `c${n}` as CookEventId,
          mealId: 'm1' as MealId,
          mealName: `Meal ${n}`,
          date: '2026-08-25',
          slotKey: 'dinner' as SlotKey,
          servingsCooked: 4 as Servings,
        },
      })),
    },
  ],
}

describe('DayColumn', () => {
  it('renders an empty Slot as an add affordance, not a hole', () => {
    render(<DayColumn day={emptyDay} isToday={false} />)
    expect(screen.getAllByTestId('slot-empty')).toHaveLength(2)
  })

  it('renders both Meals when a Slot holds two', () => {
    render(<DayColumn day={dayWithTwoDinners} isToday={false} />)
    expect(screen.getByText('Meal 1')).toBeTruthy()
    expect(screen.getByText('Meal 2')).toBeTruthy()
  })

  it('marks today', () => {
    render(<DayColumn day={emptyDay} isToday />)
    expect(screen.getByTestId('day-today-marker')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- DayColumn`
Expected: FAIL — `Cannot find module './DayColumn'`.

- [ ] **Step 4: Implement DayColumn**

Create `src/features/planning/ui/DayColumn.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { MealCard } from '@/features/meals'
import type { BoardDay } from '../domain/board'

const styles = StyleSheet.create({
  day: { paddingVertical: tokens.space.md, gap: tokens.space.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.sm },
  dayName: { ...tokens.type.display, color: tokens.color.textPrimary },
  today: { ...tokens.type.label, color: tokens.color.affirm, textTransform: 'uppercase' },
  slotLabel: { ...tokens.type.label, color: tokens.color.textMuted, textTransform: 'uppercase' },
  empty: {
    borderTopWidth: 1, borderTopColor: tokens.color.rule, borderStyle: 'dashed',
    paddingVertical: tokens.space.sm,
  },
  emptyText: { ...tokens.type.body, color: tokens.color.textMuted },
})

type Props = { readonly day: BoardDay; readonly isToday: boolean }

export const DayColumn = ({ day, isToday }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  return (
    <View style={styles.day} testID={`day-${day.date}`}>
      <View style={styles.header}>
        <Text style={styles.dayName}>{day.date}</Text>
        {isToday && (
          <Text style={styles.today} testID="day-today-marker">{t('board.today')}</Text>
        )}
      </View>
      {day.slots.map((slot) => (
        <View key={slot.slotKey} testID={`slot-${slot.slotKey}`}>
          <Text style={styles.slotLabel}>{t(slot.labelKey)}</Text>
          {slot.cards.length === 0 ? (
            <View style={styles.empty} testID="slot-empty">
              <Text style={styles.emptyText}>{t('board.addMeal')}</Text>
            </View>
          ) : (
            slot.cards.map((card) =>
              card.kind === 'cook-event' ? (
                <MealCard
                  key={card.cookEvent.id}
                  variant="planned"
                  servingsCooked={card.cookEvent.servingsCooked}
                  meal={{
                    id: card.cookEvent.mealId,
                    name: card.cookEvent.mealName,
                    servings: card.cookEvent.servingsCooked,
                  }}
                />
              ) : (
                <MealCard
                  key={card.leftover.id}
                  variant="leftover"
                  parentMealName={card.leftover.parentMealName}
                  meal={{
                    id: card.leftover.cookEventId as unknown as never,
                    name: card.leftover.parentMealName,
                    servings: 1 as never,
                  }}
                />
              ),
            )
          )}
        </View>
      ))}
    </View>
  )
}
```

An empty Slot renders as a single dashed line with an add affordance, never as
a blank gap — the design's "an empty Slot is a single dashed line rather than a
hole".

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- DayColumn`
Expected: PASS, 3 tests.

- [ ] **Step 6: Wire the data hook**

```bash
npm install @tanstack/react-query
```

Create `src/features/planning/ui/useWeekBoard.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import { currentWeekStart } from '../domain/week'
import { buildBoard, type BoardDay } from '../domain/board'
import { loadWeek } from '../infrastructure/board-repository'

/** Server state lives in TanStack Query and nowhere else; client state (which
 *  day is scrolled to, sheet open) stays in component state. They never mix. */
export const useWeekBoard = (clock: Clock = systemClock): {
  board: readonly BoardDay[]
  weekStart: string
  isLoading: boolean
} => {
  const { client, household } = useSession()
  const weekStart = currentWeekStart(clock)

  const { data, isLoading } = useQuery({
    queryKey: ['week', household?.id, weekStart],
    enabled: household !== undefined,
    queryFn: async () => {
      const result = await loadWeek(client, weekStart)
      // A Week Plan that does not exist yet is an expected outcome, not an
      // error: nobody has planned this week. Render an empty board.
      return isErr(result) ? { cookEvents: [], leftovers: [] } : result.value
    },
  })

  const board = buildBoard({
    weekStart,
    slots: household?.slots ?? [],
    cookEvents: data?.cookEvents ?? [],
    leftovers: data?.leftovers ?? [],
  })

  return { board, weekStart, isLoading }
}
```

- [ ] **Step 7: Build the screen and wire the app root**

Create `src/features/planning/ui/BoardScreen.tsx`:

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { systemClock } from '@/shared/time/clock'
import { DayColumn } from './DayColumn'
import { useWeekBoard } from './useWeekBoard'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface },
  content: { paddingHorizontal: tokens.space.md },
  title: { ...tokens.type.display, color: tokens.color.textPrimary, marginBottom: tokens.space.md },
})

export const BoardScreen = (): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { board } = useWeekBoard()
  const today = systemClock.now().toISOString().slice(0, 10)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}>
      <Text style={styles.title}>{t('board.thisWeek')}</Text>
      <View testID="board">
        {board.map((day) => (
          <DayColumn key={day.date} day={day} isToday={day.date === today} />
        ))}
      </View>
    </ScrollView>
  )
}
```

Replace `src/app/index.tsx`:

```tsx
import { BoardScreen } from '@/features/planning'

export default function Index(): React.JSX.Element {
  return <BoardScreen />
}
```

Replace `src/app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useMemo } from 'react'
import { readEnv } from '@/shared/env'
import { initI18n } from '@/shared/i18n'
import { createSupabaseClient, SessionProvider } from '@/features/household'

initI18n()

export default function RootLayout(): React.JSX.Element {
  const queryClient = useMemo(() => new QueryClient(), [])
  const client = useMemo(() => createSupabaseClient(readEnv(process.env)), [])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider client={client} household={undefined} memberId={undefined}>
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
```

`household` is `undefined` here — loading it is Task 5's repository wired to
auth, which lands in plan 02 along with sign-in. The board renders an empty
week until then, which is the correct behaviour for a Member with no Household.

Add the export to `src/features/planning/index.ts`:

```ts
export { BoardScreen } from './ui/BoardScreen'
export { useWeekBoard } from './ui/useWeekBoard'
```

- [ ] **Step 8: Run the app and look at it**

```bash
cp .env.example .env
npm run start
```

Open the app. Expected: the paper-coloured board renders "This week" (or "Tämä
viikko" on a Finnish device) with seven days, each showing lunch and dinner as
dashed empty Slots.

This is the mandatory visual verification loop from `CLAUDE.md`. A UI change
that has not been looked at is not done.

- [ ] **Step 9: Validate and commit**

```bash
npm run validate
git add -A
git commit -m "feat(planning): board screen rendering this week's Cook Events

Completes the tracer bullet: app -> feature ui -> application -> domain ->
infrastructure -> Postgres with RLS, in both locales."
```

---

### Task 10: CI and the E2E smoke flow

**Files:**
- Create: `.github/workflows/validate.yml`, `.maestro/board-smoke.yaml`
- Modify: `package.json`

**Interfaces:**
- Consumes: `npm run validate` (Tasks 1–2)
- Produces: CI mirroring local gates; one E2E flow.

- [ ] **Step 1: Write the CI workflow**

Create `.github/workflows/validate.yml`:

```yaml
name: validate

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        step: [format:check, lint, lint:boundaries, lint:duplication, type-check, test, build]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run ${{ matrix.step }}
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: failure-${{ matrix.step }}
          path: |
            coverage/
            npm-debug.log
          if-no-files-found: ignore

  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm audit --audit-level=high
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The matrix runs each gate as a parallel job with `fail-fast: false`, so one
failing gate does not hide the others — you get every problem in one run rather
than one per push.

- [ ] **Step 2: Add coverage thresholds**

Add to `jest.config.js`, at the top level alongside `projects`:

```js
coverageThreshold: {
  global: { statements: 80, branches: 80, functions: 80, lines: 80 },
},
```

Add script: `"test:coverage": "jest --coverage"`.

- [ ] **Step 3: Write the E2E smoke flow**

Create `.maestro/board-smoke.yaml`:

```yaml
appId: com.mealplanner.app
---
- launchApp
- assertVisible:
    id: "board"
- assertVisible:
    id: "day-2026-08-24"
```

The date assertion is a placeholder that must be replaced when sign-in lands in
plan 02 and the app can seed a known week. Note it in the file as a comment so
the next executor does not treat it as stable:

```yaml
# The day id is tied to a fixed clock, which does not exist until plan 02 wires
# sign-in and seeded fixtures. Replace this assertion then.
```

- [ ] **Step 4: Verify CI locally**

Run: `npm run validate`
Expected: PASS. This is what CI runs, so a green local run predicts a green CI
run.

- [ ] **Step 5: Update the docs and commit**

Add the Task 10 outcome to `docs/08-deployment.md` under CI: note that the
matrix strategy is in place and that `npm audit` and gitleaks run on every PR.

```bash
npm run validate
git add -A
git commit -m "ci(repo): parallel quality gates, dependency and secret scanning, E2E smoke"
```

---

## Self-Review

**Spec coverage.** Against `docs/01-functional-spec.md`: Household and Member
(Tasks 4–5) ✓; configurable Slots (Tasks 5, 8) ✓; Ingredient with slug identity
and per-locale names (Task 6) ✓; Meal, Catalogue Meal, copy provenance column
(Task 6) ✓; Week Plan, Backlog Item, Cook Event, Leftover with cascade (Task 7)
✓; board rendering with non-exclusive Slots (Tasks 8–9) ✓; RLS as sole
authorization point (Tasks 4, 6, 7) ✓; both Locales (Task 3) ✓; theme tokens
(Task 3) ✓; test diamond with pglite (Task 4 onward) ✓; all ten rules gated
(Tasks 1–3) ✓.

**Deliberately out of scope**, and carried by later plans: Backlog interaction
and placement (02), Meal editor and catalogue copy flow (03), Shopping List and
Staples (04), catalogue content (05), realtime and offline (06), wide-screen
panes (07). Sign-in UI is in 02; Task 9 renders an empty board for a Member with
no Household, which is correct behaviour rather than a gap.

**Known placeholders**, both flagged in place rather than hidden: the Maestro
date assertion in Task 10 Step 3, and `household={undefined}` in Task 9 Step 7.
Each names the plan that resolves it.

**Type consistency.** `HouseholdId`, `MemberId`, `SlotKey`, `Locale`, `Slot`,
`Household` (Task 5) are consumed unchanged by Tasks 6, 8, 9. `MealId`,
`Servings`, `Quantity` (Task 6) are consumed by Tasks 8, 9. `CookEvent`,
`Leftover`, `BoardCard`, `BoardDay`, `BoardSlot`, `WeekStart` (Task 8) are
consumed by Task 9. `Result`, `ok`, `err`, `isOk`, `isErr`, `Clock`,
`fixedClock`, `tokens` (Task 3) are consumed throughout. `createTestDb`,
`TestDb`, `asMember` (Task 4) are consumed by Tasks 6 and 7.
