# Foundation and Tracer Bullet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working board screen showing a real Household's planned week from
Supabase, built so that every task after the first produces something a person
can open and check.

**Architecture:** Vertical slices under `src/features`, domain logic pure and
free of IO, Supabase Postgres with row-level security as the sole authorization
point. **The board is built against fixtures first and has the database
substituted underneath it**, so the UI exists from Task 3 and every later task
visibly changes it. A seeded demo Household means the board has real content to
show from Task 5 onward.

**Toolchain:** **pnpm**, pinned with Node in `.tool-versions` (asdf) and
`.nvmrc`, with `engines` and `packageManager` in `package.json` as the
package-manager-level guard. CI reads `.nvmrc`, so there is one source
of truth. Actual versions found during Task 1: Node 24.9.0, Expo SDK 57,
React 19.2.3, React Native 0.86.3, TypeScript 6.0.

**Tech Stack:** Expo + Expo Router, TypeScript strict, Supabase (Postgres, Auth,
RLS), TanStack Query, Zod, i18next, Jest (node + jest-expo projects), pglite,
Storybook (react-native-web-vite), ESLint + Prettier + eslint-plugin-boundaries

- dependency-cruiser + jscpd, Husky + lint-staged + commitlint, GitHub Actions,
  Maestro.

**Spec:** `docs/01-functional-spec.md` (with the glossary), supported by
`docs/00-engineering-standards.md`, `docs/02-architecture.md`,
`docs/03-datamodel.md`, `docs/04-testing.md`, `docs/05-code-quality.md`,
`docs/06-security.md`, `docs/07-design-system.md`, and ADRs 0001–0009.

## What each task delivers

Your standards ask for user-visible progress early. This is what a person can
open and check at the end of each task:

| Task | Openable and checkable                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Bootstrap only.** App runs and shows a placeholder. Honestly not a functionality — it is the one unavoidable setup task.                      |
| 2    | **Storybook: all four Meal card variants, in Finnish and English.**                                                                             |
| 3    | **The board, in the app.** Seven days, configured Slots, two Meals in one Slot, a Leftover, empty Slots — from fixtures.                        |
| 4    | **Tooling only.** Boundary violations and bad commit messages get rejected. Nothing visual; demonstrate by trying to break a rule.              |
| 5    | **The board's Household name and Slot configuration now come from Postgres.** Change a row with the seed script, restart, see the board change. |
| 6    | **Cards show real Meals from the database.** Insert a Meal, it appears.                                                                         |
| 7    | **Fixtures deleted — the board is fully live.** The demo Household's planned week renders end to end.                                           |
| 8    | **CI and one E2E flow.** Tooling.                                                                                                               |

Tasks 1, 4 and 8 have no visual deliverable and say so rather than pretending
otherwise. The other five each end with a step that says: run the app and look
at it.

## Global Constraints

Every task's requirements implicitly include this section.

- **Ubiquitous language.** Use the glossary in `docs/01-functional-spec.md`
  verbatim in types, files, columns, tests and commit scopes: Household, Member,
  Slot, Week Plan, Meal, Catalogue Meal, Household Meal, Backlog Item,
  **Cook Event**, **Leftover**, Servings, Servings Cooked, Ingredient, Slug,
  Dimension, Locale, Staple, Running Low, Shopping List, Buy Line, Cupboard
  Check, Extra, Override, Provenance, Agent Prompt. Never: plan entry, recipe,
  portion, pantry item, groceries.
- **The ten rules** from `docs/05-code-quality.md`: no business logic in
  components; no hardcoded user-facing strings; no hardcoded colours or font
  sizes and no inline styles; server and client state never mix; prefer
  `undefined` over `null`; branded types for every identifier and quantity; no
  module-level singletons; no `console.*` outside the logger; no cross-feature
  imports except through `index.ts`; no circular dependencies.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. `any`, non-null
  assertions and unsafe casts are lint errors.
- **Authorization is RLS only** (ADR 0002). Never an authorization check in
  application code, and never a `where household_id = …` filter added for
  safety — that would be a second enforcement point.
- **Locales are exactly `fi` and `en`** (ADR 0009). Every user-facing string
  goes through `t()` and exists in both files.
- **Ingredient identity is `slug`**, never a name (ADR 0009).
- **Colour tokens** (`docs/07-design-system.md`): `paper #F7F2E9`,
  `paperDeep #EDE6D9`, `ink #24211C`, `muted #6B6459`, `card #FFFFFF`,
  `tint #EFE8DA`, `rule #DBD2C1`, `terracotta #C05A38`,
  `terracottaDeep #9C4529`, `sage #5F7355`, `amber #E8B04B`. Token names are
  semantic in code (`surfaceRaised`, not `white`) so the undesigned dark theme
  is a value swap.
- **Amber is the Backlog colour and is used nowhere else** — including Member
  avatar colours, which draw from a separate palette.
- **Commits:** conventional, scope required, naming the feature slice. One
  commit per task.
- **Always `pnpm run <script>`**, never `npx`. The single exception is the
  one-time scaffold in Task 1, which has no package.json to run from yet.
- **Never `--no-verify`.** Work on `feat/01-foundation`, never on `main`.

---

### Task 1: Scaffold, strict TypeScript, and the `validate` contract

**Deliverable:** the app runs. This is bootstrap, not a functionality — the only
task in the plan with nothing to demonstrate.

**Files:**

- Create: `package.json`, `tsconfig.json`, `app.json`, `.prettierrc`,
  `eslint.config.mjs`, `jest.config.js`, `jest.setup.node.js`,
  `src/app/_layout.tsx`, `src/app/index.tsx`

**Interfaces:**

- Consumes: nothing
- Produces: `pnpm run validate` (format:check → lint → type-check → test →
  build). Every later task extends this script rather than adding a parallel one.

- [ ] **Step 1: Scaffold**

The only commands run outside `pnpm run` — there is no package.json yet.

```bash
git checkout -b feat/01-foundation
printf 'nodejs 24.9.0\npnpm 10.33.0\n' > .tool-versions
printf '24.9.0\n' > .nvmrc
```

Create `.npmrc` before the first install. Metro resolves modules by walking real
paths and cannot follow pnpm's symlinked store, so the default layout produces
"Unable to resolve module" errors that read as missing dependencies:

```
# Metro cannot follow pnpm's symlinked store; a hoisted layout keeps pnpm's
# deduplicated store while giving Metro the flat tree it expects.
node-linker=hoisted

# Expo and React Native ship loose peer ranges; failing installs on them stops
# work without catching real problems.
strict-peer-dependencies=false
```

`create-expo-app` refuses to scaffold into a directory that already contains
files it might overwrite — `CLAUDE.md` and `docs/` are enough to stop it. Build
it elsewhere and copy the pieces in:

```bash
npm create expo-app@latest -- /tmp/mp-scaffold --template blank-typescript --no-install
cp -R /tmp/mp-scaffold/assets ./assets
cp /tmp/mp-scaffold/app.json /tmp/mp-scaffold/tsconfig.json .
```

Then write `package.json` by hand (Step 5) and install. Router and web packages
go through `expo install`, never plain `pnpm add` — it picks versions that
match the SDK, and `jest-expo` will otherwise pull a `react-dom` that conflicts
with the pinned React:

```bash
pnpm install
pnpm exec expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants react-dom react-native-web @expo/metro-runtime
pnpm add -D prettier eslint typescript-eslint @eslint/js jest @types/jest ts-jest jest-expo
```

- [ ] **Step 2: Strict TypeScript**

Replace `tsconfig.json`. Note there is no `baseUrl`: TypeScript 6 deprecated it
and `tsc --noEmit` fails outright on it. `paths` works without it.

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
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "*.config.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 3: ESLint**

Create `eslint.config.mjs`. Two things differ from what you might write from
memory: `tseslint.config()` is deprecated in favour of ESLint's own
`defineConfig()`, and type-aware rules must be scoped to `src/**` — pointed at
the CommonJS tool configs they fail with "not found by the project service".

```js
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    // Build output, assets and CommonJS tool configs are not application code.
    ignores: [
      'dist/**',
      '.expo/**',
      'node_modules/**',
      'coverage/**',
      'assets/**',
      'expo-env.d.ts',
      '*.config.js',
      'jest.setup.node.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression[typeAnnotation.typeName.name!="const"]',
          message: 'Unsafe cast. Construct branded values through a parser at the edge.',
        },
      ],
    },
  },
  {
    // Fixtures, tests and stories build branded values directly; that is their job.
    files: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.stories.tsx',
      'src/test/**',
      'src/**/fixtures/**',
    ],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // The flat config itself: lint it, but without type information.
    files: ['eslint.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
])
```

The `no-restricted-syntax` rule bans `as` casts outside `as const`. Branded
values are constructed by parsers at the edge, never by casting — see Task 5.

- [ ] **Step 4: Jest with two projects**

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
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
}
```

Create `jest.setup.node.js`:

```js
// A cold pglite boot (Task 5 onward) exceeds Jest's 5s default; without this
// the failure reads as a timeout rather than as whatever actually broke.
jest.setTimeout(20000)
```

- [ ] **Step 5: Scripts**

In `package.json`, set `"main": "expo-router/entry"` and add:

```json
{
  "start": "expo start",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "lint": "eslint . --max-warnings=0",
  "type-check": "tsc --noEmit",
  "test": "jest --passWithNoTests",
  "test:coverage": "jest --coverage",
  "build": "expo export --platform web",
  "validate": "pnpm run format:check && pnpm run lint && pnpm run type-check && pnpm run test && pnpm run build",
  "validate:all": "pnpm run validate"
}
```

Add `"scheme": "mealplanner"` to `app.json`. `--passWithNoTests` is removed in
Task 2 when the first test exists.

- [ ] **Step 6: Minimal app entry**

Create `src/app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'

export default function RootLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />
}
```

Create `src/app/index.tsx`:

```tsx
import { Text, View } from 'react-native'

export default function Index(): React.JSX.Element {
  return (
    <View testID="app-root">
      <Text>Meal Planner</Text>
    </View>
  )
}
```

Both are replaced in Task 3.

- [ ] **Step 7: Verify and commit**

Run: `pnpm run validate`
Expected: all five steps pass. Do not continue until they do — this script is
the contract every later task depends on.

```bash
git add -A
git commit -m "chore(repo): scaffold Expo app with strict TypeScript and validate contract"
```

---

### Task 2: Shared kernel and the Meal card — visible in Storybook

**Deliverable:** open Storybook and see all four Meal card variants, with and
without a photo, with a long Finnish name, in both locales.

**Files:**

- Create: `src/shared/types/brand.ts`, `src/shared/types/result.ts`,
  `src/shared/time/clock.ts`, `src/shared/theme/tokens.ts`,
  `src/shared/logger/logger.ts`, `src/shared/i18n/index.ts`,
  `src/shared/i18n/locales/{fi,en}.json`
- Create: `src/features/meals/domain/types.ts`,
  `src/features/meals/ui/MealCard.tsx`,
  `src/features/meals/ui/MealCard.stories.tsx`,
  `src/features/meals/index.ts`
- Create: `.storybook/main.ts`, `.storybook/preview.tsx`
- Test: `src/shared/types/result.test.ts`, `src/shared/time/clock.test.ts`,
  `src/features/meals/ui/MealCard.test.tsx`

**Interfaces:**

- Consumes: Jest from Task 1
- Produces:
  - `Brand<T, B>`; `Result<T,E>` with `ok`, `err`, `isOk`, `isErr`
  - `Clock = { now(): Date }`, `systemClock`, `fixedClock(iso)`
  - `tokens.color.*`, `tokens.type.*`, `tokens.space.*`
  - `initI18n()`, `useTranslation()`
  - `MealId`, `IngredientId`, `IngredientSlug`, `Servings`, `Quantity`, `Meal`
  - `<MealCard meal variant addedBy? servingsCooked? parentMealName? />`

- [ ] **Step 1: Write the failing kernel tests**

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

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './result'` and `'./clock'`.

- [ ] **Step 3: Implement the kernel**

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

/** "This week" and ISO week boundaries depend on the clock, so a test that
 *  cannot fix the date fails one Sunday in seven. Injected, never imported
 *  inside domain code. */
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) })
```

Remove `--passWithNoTests` from the `test` script.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm test`
Expected: PASS, 3 tests.

- [ ] **Step 5: Theme tokens**

Create `src/shared/theme/tokens.ts`. Semantic names so the undesigned dark theme
is a value swap:

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
    display: { fontSize: 34, fontWeight: '400' },
    mealName: { fontSize: 17, fontWeight: '600' },
    body: { fontSize: 15, fontWeight: '400' },
    shoppingRow: { fontSize: 19, fontWeight: '400' },
    label: { fontSize: 12, fontWeight: '600', letterSpacing: 1.4 },
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
} as const

/** Member avatar colours. Deliberately excludes `backlog` amber, which means
 *  "wanted but unplanned" and must not be diluted by appearing on a person. */
export const memberColours = ['#5F7355', '#C05A38', '#4A6670', '#7A5C74'] as const
```

- [ ] **Step 6: i18n in both locales**

```bash
pnpm add i18next react-i18next expo-localization
pnpm add -D eslint-plugin-i18next
```

Create `src/shared/i18n/locales/en.json`:

```json
{
  "board": { "thisWeek": "This week", "today": "Today", "addMeal": "Add a meal" },
  "slot": { "lunch": "Lunch", "dinner": "Dinner", "breakfast": "Breakfast" },
  "cookEvent": { "cookingCount": "Cooking {{count}}" },
  "leftover": { "suffix": "{{meal}} — leftovers" }
}
```

Create `src/shared/i18n/locales/fi.json`:

```json
{
  "board": { "thisWeek": "Tämä viikko", "today": "Tänään", "addMeal": "Lisää ateria" },
  "slot": { "lunch": "Lounas", "dinner": "Päivällinen", "breakfast": "Aamiainen" },
  "cookEvent": { "cookingCount": "Valmistetaan {{count}}" },
  "leftover": { "suffix": "{{meal}} — tähteet" }
}
```

Create `src/shared/i18n/index.ts`:

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'
import en from './locales/en.json'
import fi from './locales/fi.json'

/** Only the initial guess. Locale is a Household setting (ADR 0009) and
 *  overrides this once a Household loads, in Task 5. */
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
export { default as i18n } from 'i18next'
```

Add the literal-string rule to `eslint.config.mjs`:

```js
{
  files: ['src/**/ui/**/*.tsx', 'src/app/**/*.tsx'],
  plugins: { i18next: (await import('eslint-plugin-i18next')).default },
  rules: { 'i18next/no-literal-string': ['error', { markupOnly: true }] },
}
```

- [ ] **Step 7: The logger**

Create `src/shared/logger/logger.ts`:

```ts
type Level = 'debug' | 'info' | 'warn' | 'error'
type Context = Record<string, string | number | boolean | undefined>

/** Meal names and Member display names imply religion, health and household
 *  composition (docs/06-security.md). Redaction lives here rather than at call
 *  sites so it cannot be forgotten. */
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

- [ ] **Step 8: Meal domain types**

Create `src/features/meals/domain/types.ts`:

```ts
import type { Brand } from '@/shared/types/brand'

export type HouseholdRef = Brand<string, 'HouseholdId'>
export type MealId = Brand<string, 'MealId'>
export type IngredientId = Brand<string, 'IngredientId'>
export type IngredientSlug = Brand<string, 'IngredientSlug'>
export type Servings = Brand<number, 'Servings'>
export type Quantity = Brand<number, 'Quantity'>

export type Meal = {
  readonly id: MealId
  readonly householdId?: HouseholdRef
  readonly name: string
  readonly servings: Servings
  readonly photoUrl?: string
}

export const isCatalogueMeal = (meal: Meal): boolean => meal.householdId === undefined
```

`Servings` and `Quantity` are branded for the same reason ids are:
`scale(quantity, servings)` taking two bare numbers is the bug that puts four
kilos of onions on a shopping list.

- [ ] **Step 9: Write the failing MealCard test**

Create `src/features/meals/ui/MealCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { initI18n } from '@/shared/i18n'
import { MealCard } from './MealCard'
import type { MealId, Servings } from '../domain/types'

beforeAll(() => {
  initI18n()
})

const meal = { id: 'm1' as MealId, name: 'Chili con carne', servings: 4 as Servings }

describe('MealCard', () => {
  it('shows the Meal name', () => {
    render(<MealCard meal={meal} variant="library" />)
    expect(screen.getByText('Chili con carne')).toBeTruthy()
  })

  it('shows an initial when the Meal has no photo, so the row rhythm holds', () => {
    render(<MealCard meal={meal} variant="library" />)
    expect(screen.getByTestId('meal-card-initial')).toBeTruthy()
  })

  it('shows who added it on a backlog card, because that is the point', () => {
    render(<MealCard meal={meal} variant="backlog" addedBy="Aino" />)
    expect(screen.getByText('Aino')).toBeTruthy()
  })

  it('shows a translated servings line on a planned card', () => {
    render(<MealCard meal={meal} variant="planned" servingsCooked={6 as Servings} />)
    expect(screen.getByText('Cooking 6')).toBeTruthy()
  })

  it('names its parent on a leftover card and shows no servings', () => {
    render(<MealCard meal={meal} variant="leftover" parentMealName="Chili con carne" />)
    expect(screen.getByText('Chili con carne — leftovers')).toBeTruthy()
    expect(screen.queryByTestId('meal-card-servings-cooked')).toBeNull()
  })

  it('renders a long Finnish compound name without crashing', () => {
    const long = { ...meal, name: 'Uunilohi ja perunamuusi kermaviilikastikkeella' }
    render(<MealCard meal={long} variant="planned" servingsCooked={4 as Servings} />)
    expect(screen.getByText(long.name)).toBeTruthy()
  })
})
```

```bash
pnpm add -D @testing-library/react-native react-test-renderer
```

- [ ] **Step 10: Run to verify it fails**

Run: `pnpm test -- MealCard`
Expected: FAIL — `Cannot find module './MealCard'`.

- [ ] **Step 11: Implement MealCard**

Create `src/features/meals/ui/MealCard.tsx`:

```tsx
import { Image, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
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
  library: { borderBottomWidth: 1, borderBottomColor: tokens.color.rule },
  backlog: {
    backgroundColor: tokens.color.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: tokens.color.backlog,
  },
  planned: { backgroundColor: tokens.color.surfaceRaised, shadowOpacity: 0.06, shadowRadius: 6 },
  leftover: {
    backgroundColor: tokens.color.surfaceInset,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.color.rule,
  },
  row: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'center' },
  name: { ...tokens.type.mealName, color: tokens.color.textPrimary, flexShrink: 1 },
  support: { ...tokens.type.body, color: tokens.color.textMuted },
  initial: { ...tokens.type.display, fontSize: 20, color: tokens.color.textMuted, width: 46 },
  chip: { width: 46, height: 46, borderRadius: 6 },
})

export const MealCard = ({
  meal,
  variant,
  addedBy,
  servingsCooked,
  parentMealName,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const title =
    variant === 'leftover' && parentMealName !== undefined
      ? t('leftover.suffix', { meal: parentMealName })
      : meal.name

  return (
    <View style={[styles.base, styles[variant]]} testID={`meal-card-${variant}`}>
      <View style={styles.row}>
        {meal.photoUrl === undefined ? (
          <Text style={styles.initial} testID="meal-card-initial">
            {meal.name.slice(0, 1).toUpperCase()}
          </Text>
        ) : (
          <Image
            source={{ uri: meal.photoUrl }}
            style={styles.chip}
            accessibilityIgnoresInvertColors
          />
        )}
        <Text style={styles.name} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {addedBy !== undefined && <Text style={styles.support}>{addedBy}</Text>}
      {variant !== 'leftover' && servingsCooked !== undefined && (
        <Text style={styles.support} testID="meal-card-servings-cooked">
          {t('cookEvent.cookingCount', { count: servingsCooked })}
        </Text>
      )}
    </View>
  )
}
```

A Leftover never shows servings — it borrows them from its Cook Event and must
never read as a Meal in its own right.

- [ ] **Step 12: Run to verify it passes**

Run: `pnpm test -- MealCard`
Expected: PASS, 6 tests.

- [ ] **Step 13: Storybook with a locale switcher**

```bash
pnpm add -D storybook @storybook/react-native-web-vite vite @storybook/addon-essentials
```

Create `.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-native-web-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/react-native-web-vite', options: {} },
}
export default config
```

Create `.storybook/preview.tsx`:

```tsx
import type { Preview } from '@storybook/react'
import { initI18n, i18n } from '../src/shared/i18n'
import { tokens } from '../src/shared/theme/tokens'

initI18n()

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Locale',
      defaultValue: 'fi',
      toolbar: {
        items: [
          { value: 'fi', title: 'Suomi' },
          { value: 'en', title: 'English' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      void i18n.changeLanguage(context.globals.locale as string)
      return (
        <div style={{ background: tokens.color.surface, padding: 24, minHeight: '100vh' }}>
          <Story />
        </div>
      )
    },
  ],
}
export default preview
```

Add script: `"storybook": "storybook dev -p 6006"`.

Create `src/features/meals/ui/MealCard.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { MealCard } from './MealCard'
import type { MealId, Servings } from '../domain/types'

const meal = { id: 'm1' as MealId, name: 'Chili con carne', servings: 4 as Servings }
const longName = { ...meal, name: 'Uunilohi ja perunamuusi kermaviilikastikkeella' }
const withPhoto = { ...meal, photoUrl: 'https://placehold.co/92x92/EFE8DA/6B6459' }

const meta: Meta<typeof MealCard> = { component: MealCard, title: 'Meals/MealCard' }
export default meta
type Story = StoryObj<typeof MealCard>

export const Library: Story = { args: { meal, variant: 'library' } }
export const LibraryWithPhoto: Story = { args: { meal: withPhoto, variant: 'library' } }
export const Backlog: Story = { args: { meal, variant: 'backlog', addedBy: 'Aino' } }
export const Planned: Story = { args: { meal, variant: 'planned', servingsCooked: 6 as Servings } }
export const Leftover: Story = {
  args: { meal, variant: 'leftover', parentMealName: 'Chili con carne' },
}
export const LongFinnishName: Story = {
  args: { meal: longName, variant: 'planned', servingsCooked: 4 as Servings },
}
```

- [ ] **Step 14: Look at it**

Run: `pnpm run storybook`

Open http://localhost:6006 and check, switching the toolbar locale between
Suomi and English:

- all four variants render and are distinguishable at a glance
- the no-photo card shows an initial, and the row is the same height as the
  photo card
- the leftover card is inset, dashed, names its parent, and shows no servings
- the long Finnish name wraps to two lines and does not overflow
- the backlog card's amber edge is the only amber on screen

This is the visual verification loop from `CLAUDE.md`. If any variant is
indistinguishable from another at a glance, fix it now — the whole design rests
on the silhouette carrying the difference.

- [ ] **Step 15: Create the barrel, validate and commit**

Create `src/features/meals/index.ts`:

```ts
export type {
  Meal,
  MealId,
  IngredientId,
  IngredientSlug,
  Servings,
  Quantity,
  HouseholdRef,
} from './domain/types'
export { isCatalogueMeal } from './domain/types'
export { MealCard, type MealCardVariant } from './ui/MealCard'
```

```bash
pnpm run validate
git add -A
git commit -m "feat(meals): shared kernel, theme tokens, i18n and the four Meal card variants"
```

---

### Task 3: The board, from fixtures — first thing you can open

**Deliverable:** run the app and see a week. Seven days, the Household's Slots,
two Meals in Tuesday dinner, a Leftover on Wednesday lunch, empty Slots as
dashed add-lines. Data is fixtures; the database arrives in Task 5.

**Files:**

- Create: `src/features/household/domain/types.ts`,
  `src/features/planning/domain/types.ts`,
  `src/features/planning/domain/week.ts`,
  `src/features/planning/domain/board.ts`,
  `src/features/planning/fixtures/demo-week.ts`,
  `src/features/planning/ui/DayColumn.tsx`,
  `src/features/planning/ui/BoardScreen.tsx`,
  `src/features/planning/ui/useWeekBoard.ts`,
  `src/features/planning/index.ts`, `src/features/household/index.ts`
- Modify: `src/app/_layout.tsx`, `src/app/index.tsx`
- Test: `src/features/planning/domain/week.test.ts`,
  `src/features/planning/domain/board.test.ts`,
  `src/features/planning/ui/DayColumn.test.tsx`

**Interfaces:**

- Consumes: `Clock`, `tokens`, `useTranslation` (Task 2); `MealCard`, `MealId`,
  `Servings` (Task 2)
- Produces:
  - `HouseholdId`, `MemberId`, `SlotKey`, `Locale`, `Slot`, `Household`, `Member`
  - `WeekStart`, `WeekPlanId`, `CookEventId`, `LeftoverId`, `BacklogItemId`,
    `CookEvent`, `Leftover`, `BoardCard`
  - `currentWeekStart(clock): WeekStart`, `weekDates(weekStart): readonly string[]`
  - `buildBoard(input): readonly BoardDay[]`
  - `useWeekBoard(): { board, weekStart, isLoading }`

- [ ] **Step 1: Household and planning domain types**

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

Create `src/features/household/index.ts`:

```ts
export type {
  Household,
  HouseholdId,
  Member,
  MemberId,
  Slot,
  SlotKey,
  Locale,
} from './domain/types'
```

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

- [ ] **Step 2: Write the failing week test**

Create `src/features/planning/domain/week.test.ts`:

```ts
import { fixedClock } from '@/shared/time/clock'
import { currentWeekStart, weekDates } from './week'
import type { WeekStart } from './types'

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
    expect(weekDates('2026-08-24' as WeekStart)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ])
  })

  it('crosses a month boundary correctly', () => {
    expect(weekDates('2026-08-31' as WeekStart)[6]).toBe('2026-09-06')
  })
})
```

The Sunday case is the one that matters. A naive `getDay()` implementation
returns the _next_ Monday on Sundays, silently showing an empty week to a family
planning on Sunday evening — the single most likely moment they open the app.

- [ ] **Step 3: Run to verify it fails, then implement**

Run: `pnpm test -- week`
Expected: FAIL — `Cannot find module './week'`.

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
  const daysSinceMonday = (new Date(utcMidnight).getUTCDay() + 6) % 7
  return toIsoDate(new Date(utcMidnight - daysSinceMonday * DAY_MS)) as WeekStart
}

export const weekDates = (weekStart: WeekStart): readonly string[] => {
  const start = Date.parse(`${weekStart}T00:00:00.000Z`)
  return Array.from({ length: 7 }, (_, i) => toIsoDate(new Date(start + i * DAY_MS)))
}
```

Run: `pnpm test -- week`
Expected: PASS, 5 tests.

- [ ] **Step 4: Write the failing board test**

Create `src/features/planning/domain/board.test.ts`:

```ts
import { buildBoard } from './board'
import type { CookEvent, CookEventId, Leftover, LeftoverId, WeekStart } from './types'
import type { Slot, SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'

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

  it('gives every day the Household Slots in configured order', () => {
    const board = buildBoard({ weekStart, slots, cookEvents: [], leftovers: [] })
    expect(board[0]!.slots.map((s) => s.slotKey)).toEqual(['lunch', 'dinner'])
  })

  it('places a Cook Event in its day and Slot', () => {
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [cookEvent('c1', '2026-08-25', 'dinner')],
      leftovers: [],
    })
    expect(board[1]!.slots[1]!.cards).toHaveLength(1)
    expect(board[1]!.slots[1]!.cards[0]!.kind).toBe('cook-event')
  })

  it('keeps two Cook Events in one Slot rather than dropping either', () => {
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [
        cookEvent('c1', '2026-08-25', 'dinner'),
        cookEvent('c2', '2026-08-25', 'dinner'),
      ],
      leftovers: [],
    })
    expect(board[1]!.slots[1]!.cards).toHaveLength(2)
  })

  it("places a Leftover on its own day and Slot, not its parent's", () => {
    const leftover: Leftover = {
      id: 'l1' as LeftoverId,
      cookEventId: 'c1' as CookEventId,
      parentMealName: 'Chili con carne',
      date: '2026-08-26',
      slotKey: 'lunch' as SlotKey,
    }
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [cookEvent('c1', '2026-08-25', 'dinner')],
      leftovers: [leftover],
    })
    expect(board[2]!.slots[0]!.cards[0]!.kind).toBe('leftover')
    expect(board[1]!.slots[1]!.cards).toHaveLength(1)
  })

  it('skips a card whose Slot is no longer configured, without losing the day', () => {
    const board = buildBoard({
      weekStart,
      slots,
      cookEvents: [cookEvent('c1', '2026-08-25', 'brunch')],
      leftovers: [],
    })
    expect(board[1]!.slots.flatMap((s) => s.cards)).toHaveLength(0)
    expect(board[1]!.slots).toHaveLength(2)
  })
})
```

The last test encodes the decision in `docs/03-datamodel.md`: removing a Slot
from the Household config must not delete the Meals planned in it, so the board
tolerates an orphaned `slot_key` rather than crashing.

- [ ] **Step 5: Run to verify it fails, then implement**

Run: `pnpm test -- board`
Expected: FAIL — `Cannot find module './board'`.

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
  weekStart,
  slots,
  cookEvents,
  leftovers,
}: BuildBoardInput): readonly BoardDay[] => {
  const placed = [
    ...cookEvents.map((cookEvent) => ({
      card: { kind: 'cook-event' as const, cookEvent },
      date: cookEvent.date,
      slotKey: cookEvent.slotKey,
    })),
    ...leftovers.map((leftover) => ({
      card: { kind: 'leftover' as const, leftover },
      date: leftover.date,
      slotKey: leftover.slotKey,
    })),
  ]

  return weekDates(weekStart).map((date) => ({
    date,
    // A Slot that no longer exists in the Household config is skipped, not an
    // error: removing a Slot must never delete the Meals planned in it.
    slots: slots.map((slot) => ({
      slotKey: slot.key,
      labelKey: slot.labelKey,
      cards: placed.filter((p) => p.date === date && p.slotKey === slot.key).map((p) => p.card),
    })),
  }))
}
```

Run: `pnpm test -- board`
Expected: PASS, 6 tests.

- [ ] **Step 6: The demo fixtures**

Create `src/features/planning/fixtures/demo-week.ts`. Dates are derived from the
clock so the fixture is always _this_ week — a fixture pinned to August 2026
shows an empty board in September and wastes an afternoon.

```ts
import type { Clock } from '@/shared/time/clock'
import type { Household, HouseholdId, Slot, SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'
import { currentWeekStart, weekDates } from '../domain/week'
import type { CookEvent, CookEventId, Leftover, LeftoverId } from '../domain/types'

const slots: readonly Slot[] = [
  { key: 'lunch' as SlotKey, labelKey: 'slot.lunch' },
  { key: 'dinner' as SlotKey, labelKey: 'slot.dinner' },
]

export const demoHousehold: Household = {
  id: 'demo-household' as HouseholdId,
  name: 'Koivisto',
  locale: 'fi',
  slots,
}

const cookEvent = (
  id: string,
  mealName: string,
  date: string,
  slotKey: string,
  servings: number,
): CookEvent => ({
  id: id as CookEventId,
  mealId: `meal-${id}` as MealId,
  mealName,
  date,
  slotKey: slotKey as SlotKey,
  servingsCooked: servings as Servings,
})

/** Deliberately covers every state the board must handle: a normal day, two
 *  Meals in one Slot, a Leftover, and empty Slots. */
export const demoWeek = (
  clock: Clock,
): {
  cookEvents: readonly CookEvent[]
  leftovers: readonly Leftover[]
} => {
  const days = weekDates(currentWeekStart(clock))
  const [mon, tue, wed] = [days[0]!, days[1]!, days[2]!]

  const chili = cookEvent('c1', 'Chili con carne', mon, 'dinner', 6)

  return {
    cookEvents: [
      cookEvent('c0', 'Munavoileivät', mon, 'lunch', 2),
      chili,
      cookEvent('c2', 'Uunilohi ja perunamuusi', tue, 'dinner', 3),
      cookEvent('c3', 'Tacos', tue, 'dinner', 2),
    ],
    leftovers: [
      {
        id: 'l1' as LeftoverId,
        cookEventId: chili.id,
        parentMealName: chili.mealName,
        date: wed,
        slotKey: 'lunch' as SlotKey,
      },
    ],
  }
}
```

- [ ] **Step 7: Write the failing DayColumn test**

Create `src/features/planning/ui/DayColumn.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { initI18n } from '@/shared/i18n'
import { DayColumn } from './DayColumn'
import type { BoardDay } from '../domain/board'
import type { CookEventId } from '../domain/types'
import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'

beforeAll(() => {
  initI18n()
})

const emptyDay: BoardDay = {
  date: '2026-08-24',
  slots: [
    { slotKey: 'lunch' as SlotKey, labelKey: 'slot.lunch', cards: [] },
    { slotKey: 'dinner' as SlotKey, labelKey: 'slot.dinner', cards: [] },
  ],
}

const twoDinners: BoardDay = {
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
    render(<DayColumn day={twoDinners} isToday={false} />)
    expect(screen.getByText('Meal 1')).toBeTruthy()
    expect(screen.getByText('Meal 2')).toBeTruthy()
  })

  it('marks today', () => {
    render(<DayColumn day={emptyDay} isToday />)
    expect(screen.getByTestId('day-today-marker')).toBeTruthy()
  })

  it('does not mark a day that is not today', () => {
    render(<DayColumn day={emptyDay} isToday={false} />)
    expect(screen.queryByTestId('day-today-marker')).toBeNull()
  })
})
```

- [ ] **Step 8: Run to verify it fails, then implement**

Run: `pnpm test -- DayColumn`
Expected: FAIL — `Cannot find module './DayColumn'`.

Create `src/features/planning/ui/DayColumn.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { MealCard } from '@/features/meals'
import type { MealId, Servings } from '@/features/meals'
import type { BoardDay } from '../domain/board'

const styles = StyleSheet.create({
  day: { paddingVertical: tokens.space.md, gap: tokens.space.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.sm },
  dayName: { ...tokens.type.display, color: tokens.color.textPrimary },
  today: { ...tokens.type.label, color: tokens.color.affirm, textTransform: 'uppercase' },
  slot: { gap: tokens.space.xs },
  slotLabel: { ...tokens.type.label, color: tokens.color.textMuted, textTransform: 'uppercase' },
  empty: {
    borderTopWidth: 1,
    borderTopColor: tokens.color.rule,
    borderStyle: 'dashed',
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
          <Text style={styles.today} testID="day-today-marker">
            {t('board.today')}
          </Text>
        )}
      </View>

      {day.slots.map((slot) => (
        <View key={slot.slotKey} style={styles.slot} testID={`slot-${slot.slotKey}`}>
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
                    id: `leftover-${card.leftover.id}` as MealId,
                    name: card.leftover.parentMealName,
                    servings: 1 as Servings,
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

An empty Slot renders as one dashed add-line, never as a blank gap — the
design's "an empty Slot is a single dashed line rather than a hole".

Run: `pnpm test -- DayColumn`
Expected: PASS, 4 tests.

- [ ] **Step 9: The board hook and screen**

```bash
pnpm add @tanstack/react-query
```

Create `src/features/planning/ui/useWeekBoard.ts`. It reads fixtures now and
gains a repository in Task 7 without its signature changing:

```ts
import { systemClock, type Clock } from '@/shared/time/clock'
import { currentWeekStart } from '../domain/week'
import { buildBoard, type BoardDay } from '../domain/board'
import { demoHousehold, demoWeek } from '../fixtures/demo-week'
import type { WeekStart } from '../domain/types'

export type WeekBoard = {
  readonly board: readonly BoardDay[]
  readonly weekStart: WeekStart
  readonly householdName: string
  readonly isLoading: boolean
}

/** Fixture-backed. Task 5 substitutes the Household from Postgres and Task 7
 *  substitutes the week's contents; this signature does not change. */
export const useWeekBoard = (clock: Clock = systemClock): WeekBoard => {
  const weekStart = currentWeekStart(clock)
  const { cookEvents, leftovers } = demoWeek(clock)

  return {
    board: buildBoard({ weekStart, slots: demoHousehold.slots, cookEvents, leftovers }),
    weekStart,
    householdName: demoHousehold.name,
    isLoading: false,
  }
}
```

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
  content: { paddingHorizontal: tokens.space.md, paddingBottom: tokens.space.xl },
  household: { ...tokens.type.label, color: tokens.color.textMuted, textTransform: 'uppercase' },
  title: { ...tokens.type.display, color: tokens.color.textPrimary, marginBottom: tokens.space.md },
})

export const BoardScreen = (): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { board, householdName } = useWeekBoard()
  const today = systemClock.now().toISOString().slice(0, 10)

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + tokens.space.md }]}
      testID="board-screen"
    >
      <Text style={styles.household}>{householdName}</Text>
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

Create `src/features/planning/index.ts`:

```ts
export type {
  WeekStart,
  WeekPlanId,
  CookEvent,
  CookEventId,
  Leftover,
  LeftoverId,
  BacklogItemId,
  BoardCard,
} from './domain/types'
export { currentWeekStart, weekDates } from './domain/week'
export { buildBoard, type BoardDay, type BoardSlot, type BuildBoardInput } from './domain/board'
export { BoardScreen } from './ui/BoardScreen'
export { useWeekBoard, type WeekBoard } from './ui/useWeekBoard'
```

- [ ] **Step 10: Wire the app root**

Replace `src/app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { initI18n } from '@/shared/i18n'

initI18n()

export default function RootLayout(): React.JSX.Element {
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
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

- [ ] **Step 11: Run the app and look at it**

```bash
pnpm run start
```

Open on a phone or simulator. Check:

- "Koivisto" and "Tämä viikko" (or "This week" on an English device)
- seven days, this week's actual dates, today marked in sage
- Monday lunch and dinner both filled
- **Tuesday dinner shows two cards** — this is the design's "two Meals, that's
  fine, both get cooked"
- **Wednesday lunch shows an inset dashed Leftover card** naming Chili con carne
- every other Slot shows one dashed "Lisää ateria" line, not a gap
- scrolling the week is smooth, nothing overflows horizontally

This is the first thing in the project a person can use. If the leftover card is
not obviously secondary to the planned cards, stop and fix it — that distinction
is the one users get wrong.

- [ ] **Step 12: Validate and commit**

```bash
pnpm run validate
git add -A
git commit -m "feat(planning): board screen rendering a week from fixtures

- currentWeekStart maps Sunday back six days, not forward one
- buildBoard tolerates an orphaned slot_key so removing a Slot loses no Meals
- Fixtures are clock-derived so the demo week is always the current week"
```

---

### Task 4: Mechanical quality gates

**Deliverable:** tooling. Nothing visual — demonstrate it by trying to break a
rule and watching the build refuse. This is the second and last task with
nothing to show, and it is placed here deliberately: the boundaries now have
real slices to enforce against.

**Files:**

- Create: `.dependency-cruiser.cjs`, `.jscpd.json`, `commitlint.config.cjs`,
  `.husky/{pre-commit,commit-msg,pre-push}`
- Modify: `eslint.config.mjs`, `package.json`

**Interfaces:**

- Consumes: `pnpm run validate` (Task 1), the feature slices (Tasks 2–3)
- Produces: `validate` extended with `lint:boundaries` and `lint:duplication`

- [ ] **Step 1: Install**

```bash
pnpm add -D eslint-plugin-boundaries dependency-cruiser jscpd \
  @commitlint/cli @commitlint/config-conventional husky lint-staged
```

- [ ] **Step 2: Add the boundary rules**

Append to `eslint.config.mjs`:

```js
{
  plugins: { boundaries: (await import('eslint-plugin-boundaries')).default },
  settings: {
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/**' },
      { type: 'feature-public', pattern: 'src/features/*/index.ts', mode: 'full' },
      { type: 'feature-internal', pattern: 'src/features/*/**' },
      { type: 'shared', pattern: 'src/shared/**' },
      { type: 'test', pattern: 'src/test/**' },
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
        { from: 'test', allow: ['feature-public', 'shared'] },
      ],
    }],
  },
}
```

`mode: 'full'` on `feature-public` is load-bearing: without it `index.ts` also
matches `feature-internal`, the rule never fires, and you get a boundary gate
that silently permits everything.

- [ ] **Step 3: Prove the rule fires**

Create a deliberate violation in `src/features/planning/domain/probe.ts`:

```ts
// Temporary: proves the boundary rule rejects a deep cross-feature import.
export { MealCard } from '../../meals/ui/MealCard'
```

Run: `pnpm run lint`
Expected: FAIL, reporting that `probe.ts` may not import an element of type
`feature-internal`.

If it passes, the rule is not working — do not proceed. Check `mode: 'full'`.

Now delete it:

```bash
rm src/features/planning/domain/probe.ts
```

- [ ] **Step 4: Cycles and duplication**

Create `.dependency-cruiser.cjs`:

```js
module.exports = {
  forbidden: [{ name: 'no-circular', severity: 'error', from: {}, to: { circular: true } }],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
  },
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
  "ignore": ["**/*.test.ts", "**/*.test.tsx", "**/*.stories.tsx", "**/fixtures/**"]
}
```

Tests, stories and fixtures are excluded deliberately: near-identical setup
there is clarity, not debt, and a duplication gate that fires on it teaches
people to write worse tests.

Add scripts and extend `validate`:

```json
{
  "lint:boundaries": "depcruise src --config .dependency-cruiser.cjs",
  "lint:duplication": "jscpd",
  "validate": "pnpm run format:check && pnpm run lint && pnpm run lint:boundaries && pnpm run lint:duplication && pnpm run type-check && pnpm run test && pnpm run build"
}
```

- [ ] **Step 5: Hooks**

```bash
pnpm pkg set scripts.prepare="husky"
pnpm run prepare
```

Create `commitlint.config.cjs`:

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'style', 'chore', 'ci', 'build', 'perf'],
    ],
  },
}
```

Add to `package.json`:

```json
{ "lint-staged": { "*.{ts,tsx,js,json,md}": ["prettier --write"] } }
```

Create `.husky/pre-commit`:

```sh
if [ "$SKIP_HOOKS" = "1" ]; then
  echo "⚠️  SKIP_HOOKS=1 — pre-commit checks bypassed. This is not normal."
  exit 0
fi
pnpm exec lint-staged
pnpm run type-check
pnpm run test
```

Create `.husky/commit-msg`:

```sh
pnpm exec commitlint --edit "$1"
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
pnpm run validate:all
```

Create `.husky/pre-rebase` to block the destructive operations named in
`docs/05-code-quality.md` — `push --force`, `reset --hard`, `clean -fd` and
`branch -D` are blocked by the Claude Code hook configured separately; note in
the commit message that repo-level blocking of those is a `chore(repo)` follow-up
if the team wants it enforced outside the agent.

- [ ] **Step 6: Prove commitlint works**

Run: `echo "added stuff" | pnpm exec commitlint`
Expected: FAIL — missing type and scope.

Run: `echo "feat(planning): add cook event" | pnpm exec commitlint`
Expected: PASS.

- [ ] **Step 7: Validate and commit**

```bash
pnpm run validate
git add -A
git commit -m "chore(repo): enforce slice boundaries, cycles, duplication and commit conventions"
```

---

### Task 5: Household in Postgres, RLS, and the seeded demo Household

**Deliverable:** the board's Household name and Slot configuration come from the
database. Edit the seed, re-run it, restart the app, and watch the board change
— add a `breakfast` Slot and a third row appears on every day.

**Files:**

- Create: `supabase/schemas/00_extensions.sql`,
  `supabase/schemas/10_household.sql`,
  `supabase/schemas/90_policies_household.sql`
- Create: `src/test/db/harness.ts`, `src/test/db/auth-shim.sql`
- Create: `scripts/seed-demo.ts`, `src/shared/env.ts`, `.env.example`
- Create: `src/features/household/domain/slot.ts`,
  `src/features/household/infrastructure/supabase-client.ts`,
  `src/features/household/infrastructure/household-repository.ts`,
  `src/features/household/ui/SessionProvider.tsx`
- Modify: `src/features/household/index.ts`,
  `src/features/planning/ui/useWeekBoard.ts`, `src/app/_layout.tsx`
- Test: `src/features/household/domain/slot.test.ts`,
  `src/test/db/rls-household.test.ts`

**Interfaces:**

- Consumes: `Result` (Task 2), `Household`, `Slot`, `SlotKey` (Task 3)
- Produces:
  - `parseSlots(input): Result<readonly Slot[], 'invalid-slots'>`
  - `createSupabaseClient(env): SupabaseClient`
  - `loadHousehold(client): Promise<Result<Household, 'not-found' | 'invalid-row'>>`
  - `useSession(): { client, household, memberId }`
  - `createTestDb(): Promise<TestDb>` where `TestDb = { sql, asMember, close }`

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
  slots jsonb not null default
    '[{"key":"lunch","labelKey":"slot.lunch"},{"key":"dinner","labelKey":"slot.dinner"}]'::jsonb,
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

`slots` stores translation _keys_, not display text. Storing "Lounas" here would
make the board monolingual and break ADR 0009 at the data layer.

- [ ] **Step 2: Write the policies**

Create `supabase/schemas/90_policies_household.sql`:

```sql
-- SECURITY DEFINER so the membership lookup is not subject to the policy it
-- supports, which would recurse infinitely.
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

-- The second branch lets the first Member of a brand-new Household create
-- their own membership. Without it, creating a Household is impossible: nobody
-- is a member yet, so app.is_member is false for everyone.
create policy household_member_insert on household_member
  for insert with check (
    app.is_member(household_id)
    or not exists (
      select 1 from household_member existing
      where existing.household_id = household_member.household_id
    )
  );
```

- [ ] **Step 3: The pglite harness with the auth shim**

```bash
pnpm add -D @electric-sql/pglite tsx
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

// Order matters: the auth shim must exist before policies that call auth.uid().
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

  // Policies do not apply to the table owner, so tests must run as a role that
  // is subject to them — exactly as anon/authenticated are in production.
  await db.exec(`
    create role authenticated nologin;
    grant usage on schema public, app to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema app to authenticated;
  `)

  return {
    sql: async (query, params = []) => (await db.query(query, params)).rows,
    asMember: async (userId) => {
      await db.exec('set role authenticated;')
      await db.query('select set_config($1, $2, false)', ['app.current_user_id', userId])
    },
    close: () => db.close(),
  }
}
```

- [ ] **Step 4: Write the failing adversarial RLS test**

Create `src/test/db/rls-household.test.ts`. Note what is asserted: not that a
Member can read their own Household, which proves nothing, but that they cannot
reach another's.

```ts
import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('household RLS', () => {
  let db: TestDb
  let aliceHousehold: string
  let bobHousehold: string

  const seed = async (name: string, userId: string): Promise<string> => {
    const [row] = (await db.sql('insert into household (name) values ($1) returning id', [
      name,
    ])) as { id: string }[]
    await db.sql(
      `insert into household_member (household_id, user_id, role, display_name, colour)
       values ($1, $2, 'owner', 'Owner', '#5F7355')`,
      [row!.id, userId],
    )
    return row!.id
  }

  beforeAll(async () => {
    db = await createTestDb()
    // Seeded as the table owner, before any set role — policies do not apply to
    // the owner, which is how the fixtures get created at all.
    aliceHousehold = await seed('Alice household', ALICE)
    bobHousehold = await seed('Bob household', BOB)
  })

  afterAll(async () => {
    await db.close()
  })

  it('lets a Member read their own Household', async () => {
    await db.asMember(ALICE)
    const rows = (await db.sql('select id from household')) as { id: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(aliceHousehold)
  })

  it('hides another Household entirely', async () => {
    await db.asMember(ALICE)
    expect(await db.sql('select id from household where id = $1', [bobHousehold])).toHaveLength(0)
  })

  it('refuses to update another Household', async () => {
    await db.asMember(ALICE)
    await db.sql("update household set name = 'stolen' where id = $1", [bobHousehold])
    await db.asMember(BOB)
    const rows = (await db.sql('select name from household where id = $1', [bobHousehold])) as {
      name: string
    }[]
    expect(rows[0]!.name).toBe('Bob household')
  })

  it("hides another Household's Members", async () => {
    await db.asMember(ALICE)
    expect(
      await db.sql('select user_id from household_member where household_id = $1', [bobHousehold]),
    ).toHaveLength(0)
  })

  it('leaves a Household unreachable once membership is removed', async () => {
    const temp = await seed('Temp household', ALICE)
    await db.sql('delete from household_member where household_id = $1', [temp])
    await db.asMember(ALICE)
    expect(await db.sql('select id from household where id = $1', [temp])).toHaveLength(0)
  })
})
```

- [ ] **Step 5: Run to verify it fails, then passes**

Run: `pnpm test -- rls-household`
Expected first: FAIL — a schema file is missing, or `relation "household" does
not exist`.

Create any missing SQL files, then re-run.

Run: `pnpm test -- rls-household`
Expected: PASS, 5 tests.

If "hides another Household" returns a row, `set role authenticated` did not
take effect — confirm `asMember` is awaited everywhere.

- [ ] **Step 6: Write the failing Slot parser test**

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

  it('preserves order, because the board renders Slots as configured', () => {
    const result = parseSlots([
      { key: 'dinner', labelKey: 'slot.dinner' },
      { key: 'lunch', labelKey: 'slot.lunch' },
    ])
    if (isOk(result)) expect(result.value.map((s) => s.key)).toEqual(['dinner', 'lunch'])
  })

  it('rejects duplicate keys', () => {
    expect(
      isErr(
        parseSlots([
          { key: 'lunch', labelKey: 'slot.lunch' },
          { key: 'lunch', labelKey: 'slot.lunch' },
        ]),
      ),
    ).toBe(true)
  })

  it('rejects a non-array', () => {
    expect(isErr(parseSlots('lunch,dinner'))).toBe(true)
  })
})
```

- [ ] **Step 7: Run to verify it fails, then implement**

Run: `pnpm test -- slot`
Expected: FAIL — `Cannot find module './slot'`.

```bash
pnpm add zod @supabase/supabase-js @react-native-async-storage/async-storage
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

Run: `pnpm test -- slot`
Expected: PASS, 4 tests.

- [ ] **Step 8: Validated environment and the client factory**

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
 *  service role key is never read here — only by scripts/seed-demo.ts. */
export const readEnv = (source: Record<string, string | undefined>): Env => envSchema.parse(source)
```

Create `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key

# Seeding only. Never prefixed EXPO_PUBLIC_ — that would publish it.
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
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

- [ ] **Step 9: The Household repository**

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
  // No household_id filter: RLS already restricts the row set to the Member's
  // own Household (ADR 0002). A filter here would be a second enforcement point.
  const { data } = await client
    .from('household')
    .select('id,name,locale,slots')
    .limit(1)
    .maybeSingle()
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

- [ ] **Step 10: The session provider**

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
  const value = useMemo(() => ({ client, household, memberId }), [client, household, memberId])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = (): SessionValue => {
  const value = useContext(SessionContext)
  if (value === undefined) throw new Error('useSession used outside SessionProvider')
  return value
}
```

Update `src/features/household/index.ts`:

```ts
export type {
  Household,
  HouseholdId,
  Member,
  MemberId,
  Slot,
  SlotKey,
  Locale,
} from './domain/types'
export { parseSlots, type ParseSlotsError } from './domain/slot'
export { createSupabaseClient } from './infrastructure/supabase-client'
export { loadHousehold, type LoadHouseholdError } from './infrastructure/household-repository'
export { SessionProvider, useSession } from './ui/SessionProvider'
```

- [ ] **Step 11: The seed script**

Install the Supabase CLI if absent, then:

```bash
pnpm exec supabase init
pnpm exec supabase start
```

Create `scripts/seed-demo.ts`. Dates are computed from today so the demo week is
always the current week:

```ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (url === undefined || serviceRoleKey === undefined) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

/** Member colours exclude backlog amber, which means "wanted but unplanned" and
 *  must not be diluted by appearing on a person. */
const MEMBERS = [
  { userId: DEMO_USER_ID, displayName: 'Aino', colour: '#5F7355', role: 'owner' },
  {
    userId: '00000000-0000-0000-0000-000000000002',
    displayName: 'Sanni',
    colour: '#C05A38',
    role: 'member',
  },
  {
    userId: '00000000-0000-0000-0000-000000000003',
    displayName: 'Mikko',
    colour: '#4A6670',
    role: 'member',
  },
]

const seed = async (): Promise<void> => {
  await admin
    .from('household_member')
    .delete()
    .neq('user_id', '00000000-0000-0000-0000-000000000000')
  await admin.from('household').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const { data: household, error } = await admin
    .from('household')
    .insert({ name: 'Koivisto', locale: 'fi' })
    .select('id')
    .single()
  if (error !== null) throw new Error(`Failed to create Household: ${error.message}`)

  const householdId = (household as { id: string }).id

  const { error: memberError } = await admin.from('household_member').insert(
    MEMBERS.map((m) => ({
      household_id: householdId,
      user_id: m.userId,
      role: m.role,
      display_name: m.displayName,
      colour: m.colour,
    })),
  )
  if (memberError !== null) throw new Error(`Failed to create Members: ${memberError.message}`)

  process.stdout.write(`Seeded Household ${householdId} with ${String(MEMBERS.length)} Members\n`)
}

void seed()
```

Add script: `"db:seed": "tsx --env-file=.env scripts/seed-demo.ts"`.

Add to `package.json`: `"db:reset": "supabase db reset"` and apply the schema
files as a migration:

```bash
mkdir -p supabase/migrations
cat supabase/schemas/00_extensions.sql supabase/schemas/10_household.sql \
    supabase/schemas/90_policies_household.sql \
    > supabase/migrations/20260908000000_household.sql
pnpm exec supabase db reset
```

- [ ] **Step 12: Substitute the Household into the board**

Modify `src/features/planning/ui/useWeekBoard.ts` — the Household now comes from
the session; the week's contents remain fixtures until Task 7:

```ts
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import { currentWeekStart } from '../domain/week'
import { buildBoard, type BoardDay } from '../domain/board'
import { demoWeek } from '../fixtures/demo-week'
import type { WeekStart } from '../domain/types'

export type WeekBoard = {
  readonly board: readonly BoardDay[]
  readonly weekStart: WeekStart
  readonly householdName: string
  readonly isLoading: boolean
}

export const useWeekBoard = (clock: Clock = systemClock): WeekBoard => {
  const { household } = useSession()
  const weekStart = currentWeekStart(clock)
  const { cookEvents, leftovers } = demoWeek(clock)

  return {
    board: buildBoard({ weekStart, slots: household?.slots ?? [], cookEvents, leftovers }),
    weekStart,
    householdName: household?.name ?? '',
    isLoading: household === undefined,
  }
}
```

Modify `src/app/_layout.tsx` to load the Household and provide the session:

```tsx
import { Stack } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { readEnv } from '@/shared/env'
import { initI18n, i18n } from '@/shared/i18n'
import {
  createSupabaseClient,
  loadHousehold,
  SessionProvider,
  type Household,
} from '@/features/household'
import { isOk } from '@/shared/types/result'

initI18n()

export default function RootLayout(): React.JSX.Element {
  const queryClient = useMemo(() => new QueryClient(), [])
  const client = useMemo(() => createSupabaseClient(readEnv(process.env)), [])
  const [household, setHousehold] = useState<Household | undefined>(undefined)

  useEffect(() => {
    void loadHousehold(client).then((result) => {
      if (!isOk(result)) return
      setHousehold(result.value)
      // Household Locale overrides the device guess (ADR 0009).
      void i18n.changeLanguage(result.value.locale)
    })
  }, [client])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider client={client} household={household} memberId={undefined}>
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
```

Until sign-in exists (plan 02), RLS returns no rows for an anonymous client. For
this task, temporarily grant read access to `anon` so the demo is visible:

```sql
-- supabase/migrations/20260908000001_demo_anon_read.sql
-- TEMPORARY, removed in plan 02 when sign-in lands. Documented here so it is
-- deleted deliberately rather than forgotten into production.
create policy household_demo_anon_select on household for select to anon using (true);
```

Add a line to `docs/06-security.md` under "Authorization" recording this policy,
its expiry (plan 02), and that it must never reach the production project.

- [ ] **Step 13: Run it and look at it**

```bash
pnpm exec supabase db reset
pnpm run db:seed
pnpm run start
```

Check the board shows "Koivisto" from Postgres, with lunch and dinner rows.

Now prove the substitution is real. Add a Slot:

```bash
psql "$(pnpm exec supabase status -o env | grep DB_URL | cut -d= -f2-)" -c \
  $'update household set slots = \'[{"key":"breakfast","labelKey":"slot.breakfast"},{"key":"lunch","labelKey":"slot.lunch"},{"key":"dinner","labelKey":"slot.dinner"}]\'::jsonb'
```

Restart the app. Expected: **every day now has three rows, breakfast first, in
Finnish.** The board is reading configuration from the database.

Revert with `pnpm run db:seed`.

- [ ] **Step 14: Validate and commit**

```bash
pnpm run validate
git add -A
git commit -m "feat(household): Household schema with RLS, seed script and live Slot config

- app.is_member SECURITY DEFINER helper avoids policy recursion
- Bootstrap branch on member insert so a first Household can be created
- pglite harness with auth.uid() shim for integration tests (ADR 0007)
- Board reads Household name and Slots from Postgres; week is still fixtures"
```

---

### Task 6: Meals in Postgres — cards show real Meals

**Deliverable:** insert a Meal with the seed script and it appears on the board.
Ingredient slugs are in place, so a Finnish and an English name resolve to one
Ingredient.

**Files:**

- Create: `supabase/schemas/20_meals.sql`, `supabase/schemas/91_policies_meals.sql`
- Create: `data/ingredients.json`, `src/features/meals/infrastructure/meal-repository.ts`
- Modify: `src/test/db/harness.ts`, `scripts/seed-demo.ts`,
  `src/features/meals/index.ts`
- Test: `src/test/db/rls-meals.test.ts`

**Interfaces:**

- Consumes: `createTestDb` (Task 5), `Meal`, `MealId`, `Servings` (Task 2)
- Produces: `loadMeals(client): Promise<Result<readonly Meal[], 'invalid-row'>>`

- [ ] **Step 1: Write the schema**

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
line rather than silently omitting it (plan 04).

- [ ] **Step 2: Write the policies**

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
    select 1 from ingredient i
    where i.id = ingredient_name.ingredient_id
      and (i.household_id is null or app.is_member(i.household_id))
  ));

create policy meal_select on meal
  for select using (household_id is null or app.is_member(household_id));

create policy meal_write on meal
  for all using (household_id is not null and app.is_member(household_id))
  with check (household_id is not null and app.is_member(household_id));

create policy meal_ingredient_select on meal_ingredient
  for select using (exists (
    select 1 from meal m
    where m.id = meal_ingredient.meal_id
      and (m.household_id is null or app.is_member(m.household_id))
  ));

create policy meal_ingredient_write on meal_ingredient
  for all using (exists (
    select 1 from meal m
    where m.id = meal_ingredient.meal_id
      and m.household_id is not null and app.is_member(m.household_id)
  ))
  with check (exists (
    select 1 from meal m
    where m.id = meal_ingredient.meal_id
      and m.household_id is not null and app.is_member(m.household_id)
  ));
```

- [ ] **Step 3: Write the failing Meal RLS test**

Add `'supabase/schemas/20_meals.sql'` and `'supabase/schemas/91_policies_meals.sql'`
to `SCHEMA_FILES` in `src/test/db/harness.ts`, after `10_household.sql` and
after `90_policies_household.sql` respectively.

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
      const [h] = (await db.sql('insert into household (name) values ($1) returning id', [
        name,
      ])) as { id: string }[]
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
      "insert into meal (household_id, name, servings) values ($1, 'Bob chili', 4) returning id",
      [bobHousehold],
    )) as { id: string }[]
    bobMeal = bm!.id

    const [cm] = (await db.sql(
      "insert into meal (household_id, name, servings) values (null, 'Shakshuka', 2) returning id",
    )) as { id: string }[]
    catalogueMeal = cm!.id
  })

  afterAll(async () => {
    await db.close()
  })

  it("hides another Household's Meal", async () => {
    await db.asMember(ALICE)
    expect(await db.sql('select id from meal where id = $1', [bobMeal])).toHaveLength(0)
  })

  it('shows Catalogue Meals to everyone', async () => {
    await db.asMember(ALICE)
    expect(await db.sql('select id from meal where id = $1', [catalogueMeal])).toHaveLength(1)
  })

  it('refuses to let a Household edit a Catalogue Meal', async () => {
    await db.asMember(ALICE)
    await db.sql("update meal set name = 'hijacked' where id = $1", [catalogueMeal])
    const rows = (await db.sql('select name from meal where id = $1', [catalogueMeal])) as {
      name: string
    }[]
    expect(rows[0]!.name).toBe('Shakshuka')
  })

  it('allows a Meal with no Ingredients, for the day-one quick-add path', async () => {
    await db.asMember(ALICE)
    await db.sql("insert into meal (household_id, name, servings) values ($1, 'Tacos', 4)", [
      aliceHousehold,
    ])
    const rows = (await db.sql(
      `select count(mi.ingredient_id) as ingredient_count
       from meal m left join meal_ingredient mi on mi.meal_id = m.id
       where m.name = 'Tacos' group by m.id`,
    )) as { ingredient_count: string }[]
    expect(rows[0]!.ingredient_count).toBe('0')
  })

  it('resolves one Ingredient from two Locale names', async () => {
    const [ing] = (await db.sql(
      `insert into ingredient (household_id, slug, category, dimension, base_unit)
       values (null, 'onion', 'produce', 'count', 'pcs') returning id`,
    )) as { id: string }[]
    await db.sql(
      `insert into ingredient_name (ingredient_id, locale, name)
       values ($1, 'fi', 'sipuli'), ($1, 'en', 'onion')`,
      [ing!.id],
    )
    await db.asMember(ALICE)
    const rows = await db.sql(
      `select n.locale from ingredient i join ingredient_name n on n.ingredient_id = i.id
       where i.slug = 'onion' order by n.locale`,
    )
    expect(rows).toHaveLength(2)
  })
})
```

- [ ] **Step 4: Run to verify it fails, then passes**

Run: `pnpm test -- rls-meals`
Expected first: FAIL — `relation "meal" does not exist`.

Create the SQL files, add them to `SCHEMA_FILES`, re-run.

Run: `pnpm test -- rls-meals`
Expected: PASS, 5 tests.

- [ ] **Step 5: Reference data for Ingredients**

Create `data/ingredients.json` — data as code, per `docs/02-architecture.md`:

```json
[
  {
    "slug": "onion",
    "category": "produce",
    "dimension": "count",
    "baseUnit": "pcs",
    "names": { "fi": "sipuli", "en": "onion" }
  },
  {
    "slug": "minced-beef",
    "category": "meat",
    "dimension": "mass",
    "baseUnit": "g",
    "names": { "fi": "jauheliha", "en": "minced beef" }
  },
  {
    "slug": "tinned-tomatoes",
    "category": "dry-goods",
    "dimension": "count",
    "baseUnit": "tin",
    "names": { "fi": "tomaattimurska", "en": "tinned tomatoes" }
  },
  {
    "slug": "salmon-fillet",
    "category": "fish",
    "dimension": "mass",
    "baseUnit": "g",
    "names": { "fi": "lohifile", "en": "salmon fillet" }
  },
  {
    "slug": "potato",
    "category": "produce",
    "dimension": "mass",
    "baseUnit": "g",
    "names": { "fi": "peruna", "en": "potato" }
  },
  {
    "slug": "ground-cumin",
    "category": "spices",
    "dimension": "mass",
    "baseUnit": "g",
    "names": { "fi": "juustokumina", "en": "ground cumin" }
  }
]
```

- [ ] **Step 6: Extend the seed script with Meals**

Add to `scripts/seed-demo.ts`, after the Members insert, and add
`import ingredients from '../data/ingredients.json'` at the top:

```ts
const MEALS = [
  {
    name: 'Chili con carne',
    servings: 4,
    ingredients: [
      { slug: 'onion', quantity: 2, unit: 'pcs' },
      { slug: 'minced-beef', quantity: 400, unit: 'g' },
      { slug: 'tinned-tomatoes', quantity: 2, unit: 'tin' },
      { slug: 'ground-cumin', quantity: 5, unit: 'g' },
    ],
  },
  {
    name: 'Uunilohi ja perunamuusi',
    servings: 4,
    ingredients: [
      { slug: 'salmon-fillet', quantity: 600, unit: 'g' },
      { slug: 'potato', quantity: 1000, unit: 'g' },
    ],
  },
  { name: 'Munavoileivät', servings: 2, ingredients: [] },
  { name: 'Tacos', servings: 4, ingredients: [] },
]

const seedMeals = async (householdId: string): Promise<void> => {
  const slugToId = new Map<string, string>()

  for (const ing of ingredients) {
    const { data, error } = await admin
      .from('ingredient')
      .insert({
        household_id: null,
        slug: ing.slug,
        category: ing.category,
        dimension: ing.dimension,
        base_unit: ing.baseUnit,
      })
      .select('id')
      .single()
    if (error !== null) throw new Error(`Ingredient ${ing.slug}: ${error.message}`)

    const ingredientId = (data as { id: string }).id
    slugToId.set(ing.slug, ingredientId)

    const { error: nameError } = await admin.from('ingredient_name').insert(
      Object.entries(ing.names).map(([locale, name]) => ({
        ingredient_id: ingredientId,
        locale,
        name,
      })),
    )
    if (nameError !== null) throw new Error(`Ingredient names ${ing.slug}: ${nameError.message}`)
  }

  for (const meal of MEALS) {
    const { data, error } = await admin
      .from('meal')
      .insert({ household_id: householdId, name: meal.name, servings: meal.servings })
      .select('id')
      .single()
    if (error !== null) throw new Error(`Meal ${meal.name}: ${error.message}`)

    if (meal.ingredients.length === 0) continue

    const mealId = (data as { id: string }).id
    const { error: miError } = await admin.from('meal_ingredient').insert(
      meal.ingredients.map((mi) => {
        const ingredientId = slugToId.get(mi.slug)
        if (ingredientId === undefined) throw new Error(`Unknown Ingredient slug: ${mi.slug}`)
        return {
          meal_id: mealId,
          ingredient_id: ingredientId,
          quantity: mi.quantity,
          unit: mi.unit,
        }
      }),
    )
    if (miError !== null) throw new Error(`Meal Ingredients ${meal.name}: ${miError.message}`)
  }

  process.stdout.write(`Seeded ${String(MEALS.length)} Meals\n`)
}
```

Call `await seedMeals(householdId)` at the end of `seed()`, and add
`await admin.from('ingredient').delete().is('household_id', null)` to the reset
block at the top so re-seeding is idempotent.

Two of the four Meals deliberately have no Ingredients — `Munavoileivät` and
`Tacos` — so the incomplete-Meal path in plan 04 has real data to render.

- [ ] **Step 7: Read Meals in the app**

Create `src/features/meals/infrastructure/meal-repository.ts`:

```ts
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ok, err, type Result } from '@/shared/types/result'
import type { HouseholdRef, Meal, MealId, Servings } from '../domain/types'

const rowSchema = z.object({
  id: z.string().uuid(),
  household_id: z.string().uuid().nullable(),
  name: z.string(),
  servings: z.number().int(),
  photo_url: z.string().nullable(),
})

export type LoadMealsError = 'invalid-row'

export const loadMeals = async (
  client: SupabaseClient,
): Promise<Result<readonly Meal[], LoadMealsError>> => {
  const { data } = await client.from('meal').select('id,household_id,name,servings,photo_url')
  const rows = z.array(rowSchema).safeParse(data ?? [])
  if (!rows.success) return err('invalid-row')

  // null at the edge becomes undefined inside; the domain never carries null.
  return ok(
    rows.data.map((r) => ({
      id: r.id as MealId,
      ...(r.household_id === null ? {} : { householdId: r.household_id as HouseholdRef }),
      name: r.name,
      servings: r.servings as Servings,
      ...(r.photo_url === null ? {} : { photoUrl: r.photo_url }),
    })),
  )
}
```

Add to `src/features/meals/index.ts`:

```ts
export { loadMeals, type LoadMealsError } from './infrastructure/meal-repository'
```

- [ ] **Step 8: Regenerate the migration, seed, and look at it**

```bash
cat supabase/schemas/20_meals.sql supabase/schemas/91_policies_meals.sql \
    > supabase/migrations/20260908000002_meals.sql
pnpm exec supabase db reset
pnpm run db:seed
```

Add the temporary anon-read policies for the new tables to
`supabase/migrations/20260908000001_demo_anon_read.sql`, with the same expiry
comment:

```sql
create policy meal_demo_anon_select on meal for select to anon using (true);
create policy ingredient_demo_anon_select on ingredient for select to anon using (true);
```

Run the app and, from a debug screen or a temporary `console` in a test, confirm
`loadMeals` returns four Meals with `Munavoileivät` and `Tacos` carrying no
Ingredients. The board still shows fixture Cook Events; Task 7 connects them.

- [ ] **Step 9: Validate and commit**

```bash
pnpm run validate
git add -A
git commit -m "feat(meals): Meal and Ingredient schema with slug-keyed identity

- Ingredient identity is a locale-independent slug with per-Locale names (ADR 0009)
- Catalogue Meals readable by all, editable by none through the client
- Ingredient reference data lives in data/ingredients.json as code
- Seed includes two Meals with no Ingredients for the day-one path"
```

---

### Task 7: Planning in Postgres — fixtures deleted, board fully live

**Deliverable:** the demo Household's planned week renders end to end from the
database. Delete a Cook Event with SQL and its Leftover disappears with it.

**Files:**

- Create: `supabase/schemas/30_planning.sql`,
  `supabase/schemas/92_policies_planning.sql`,
  `src/features/planning/infrastructure/board-repository.ts`
- Delete: `src/features/planning/fixtures/demo-week.ts`
- Modify: `src/test/db/harness.ts`, `scripts/seed-demo.ts`,
  `src/features/planning/ui/useWeekBoard.ts`, `src/features/planning/index.ts`
- Test: `src/test/db/rls-planning.test.ts`

**Interfaces:**

- Consumes: `createTestDb` (Task 5), `buildBoard`, `currentWeekStart` (Task 3)
- Produces: `loadWeek(client, weekStart): Promise<Result<WeekContents, LoadWeekError>>`
  where `WeekContents = { cookEvents: readonly CookEvent[]; leftovers: readonly Leftover[] }`

- [ ] **Step 1: Write the schema**

Create `supabase/schemas/30_planning.sql`:

```sql
create table week_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  week_start date not null,
  unique (household_id, week_start),
  -- ISO weeks start on Monday; extract(isodow) returns 1 for Monday.
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
Event, and the cascade guarantees it can never be stranded (ADR 0004).

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
    select 1 from week_plan w where w.id = backlog_item.week_plan_id and app.is_member(w.household_id)
  ))
  with check (exists (
    select 1 from week_plan w where w.id = backlog_item.week_plan_id and app.is_member(w.household_id)
  ));

create policy cook_event_all on cook_event
  for all using (exists (
    select 1 from week_plan w where w.id = cook_event.week_plan_id and app.is_member(w.household_id)
  ))
  with check (exists (
    select 1 from week_plan w where w.id = cook_event.week_plan_id and app.is_member(w.household_id)
  ));

create policy leftover_all on leftover
  for all using (exists (
    select 1 from cook_event c join week_plan w on w.id = c.week_plan_id
    where c.id = leftover.cook_event_id and app.is_member(w.household_id)
  ))
  with check (exists (
    select 1 from cook_event c join week_plan w on w.id = c.week_plan_id
    where c.id = leftover.cook_event_id and app.is_member(w.household_id)
  ));
```

- [ ] **Step 3: Write the failing planning RLS and cascade test**

Add the two files to `SCHEMA_FILES` in the harness, after `20_meals.sql` and
after `91_policies_meals.sql`.

Create `src/test/db/rls-planning.test.ts`:

```ts
import { createTestDb, type TestDb } from './harness'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

describe('planning RLS and cascades', () => {
  let db: TestDb
  let aliceWeek: string
  let aliceMeal: string
  let bobWeek: string

  beforeAll(async () => {
    db = await createTestDb()

    const seed = async (name: string, userId: string): Promise<{ week: string; meal: string }> => {
      const [h] = (await db.sql('insert into household (name) values ($1) returning id', [
        name,
      ])) as { id: string }[]
      await db.sql(
        `insert into household_member (household_id, user_id, role, display_name, colour)
         values ($1, $2, 'owner', 'Owner', '#5F7355')`,
        [h!.id, userId],
      )
      const [w] = (await db.sql(
        "insert into week_plan (household_id, week_start) values ($1, '2026-08-24') returning id",
        [h!.id],
      )) as { id: string }[]
      const [m] = (await db.sql(
        "insert into meal (household_id, name, servings) values ($1, 'Chili', 4) returning id",
        [h!.id],
      )) as { id: string }[]
      return { week: w!.id, meal: m!.id }
    }

    const alice = await seed('Alice household', ALICE)
    const bob = await seed('Bob household', BOB)
    aliceWeek = alice.week
    aliceMeal = alice.meal
    bobWeek = bob.week
  })

  afterAll(async () => {
    await db.close()
  })

  it('rejects a week_start that is not a Monday', async () => {
    await expect(
      db.sql(
        `insert into week_plan (household_id, week_start)
              select household_id, '2026-08-25' from week_plan where id = $1`,
        [aliceWeek],
      ),
    ).rejects.toThrow()
  })

  it("hides another Household's Week Plan", async () => {
    await db.asMember(ALICE)
    expect(await db.sql('select id from week_plan where id = $1', [bobWeek])).toHaveLength(0)
  })

  it("refuses a Cook Event inserted into another Household's Week Plan", async () => {
    await db.asMember(ALICE)
    await expect(
      db.sql(
        `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
         values ($1, $2, '2026-08-25', 'dinner', 4)`,
        [bobWeek, aliceMeal],
      ),
    ).rejects.toThrow()
  })

  it('allows two Cook Events in the same day and Slot', async () => {
    await db.asMember(ALICE)
    for (const _ of [1, 2]) {
      await db.sql(
        `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
         values ($1, $2, '2026-08-25', 'dinner', 4)`,
        [aliceWeek, aliceMeal],
      )
    }
    expect(
      await db.sql(
        "select id from cook_event where week_plan_id = $1 and date = '2026-08-25' and slot_key = 'dinner'",
        [aliceWeek],
      ),
    ).toHaveLength(2)
  })

  it('takes Leftovers with the Cook Event when it is deleted', async () => {
    await db.asMember(ALICE)
    const [ce] = (await db.sql(
      `insert into cook_event (week_plan_id, meal_id, date, slot_key, servings_cooked)
       values ($1, $2, '2026-08-26', 'dinner', 6) returning id`,
      [aliceWeek, aliceMeal],
    )) as { id: string }[]
    await db.sql(
      "insert into leftover (cook_event_id, date, slot_key) values ($1, '2026-08-27', 'lunch')",
      [ce!.id],
    )
    await db.sql('delete from cook_event where id = $1', [ce!.id])
    expect(await db.sql('select id from leftover where cook_event_id = $1', [ce!.id])).toHaveLength(
      0,
    )
  })
})
```

- [ ] **Step 4: Run to verify it fails, then passes**

Run: `pnpm test -- rls-planning`
Expected first: FAIL — `relation "week_plan" does not exist`.

Create the SQL files, add to `SCHEMA_FILES`, re-run.

Run: `pnpm test -- rls-planning`
Expected: PASS, 5 tests.

- [ ] **Step 5: The board repository**

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
    .from('week_plan')
    .select('id')
    .eq('week_start', weekStart)
    .maybeSingle()
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

- [ ] **Step 6: Substitute the repository and delete the fixtures**

Replace `src/features/planning/ui/useWeekBoard.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { isErr } from '@/shared/types/result'
import { systemClock, type Clock } from '@/shared/time/clock'
import { useSession } from '@/features/household'
import { currentWeekStart } from '../domain/week'
import { buildBoard, type BoardDay } from '../domain/board'
import { loadWeek } from '../infrastructure/board-repository'
import type { WeekStart } from '../domain/types'

export type WeekBoard = {
  readonly board: readonly BoardDay[]
  readonly weekStart: WeekStart
  readonly householdName: string
  readonly isLoading: boolean
}

/** Server state lives in TanStack Query and nowhere else; client state (which
 *  day is scrolled to, sheet open) stays in component state. They never mix. */
export const useWeekBoard = (clock: Clock = systemClock): WeekBoard => {
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

  return {
    board: buildBoard({
      weekStart,
      slots: household?.slots ?? [],
      cookEvents: data?.cookEvents ?? [],
      leftovers: data?.leftovers ?? [],
    }),
    weekStart,
    householdName: household?.name ?? '',
    isLoading: isLoading || household === undefined,
  }
}
```

```bash
rm src/features/planning/fixtures/demo-week.ts
```

Add to `src/features/planning/index.ts`:

```ts
export { loadWeek, type WeekContents, type LoadWeekError } from './infrastructure/board-repository'
```

- [ ] **Step 7: Seed a planned week**

Add to `scripts/seed-demo.ts`. The Monday is computed from today so the demo is
always this week:

```ts
const mondayOfThisWeek = (): string => {
  const now = new Date()
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const daysSinceMonday = (new Date(utcMidnight).getUTCDay() + 6) % 7
  return new Date(utcMidnight - daysSinceMonday * 86_400_000).toISOString().slice(0, 10)
}

const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10)

const seedWeek = async (householdId: string): Promise<void> => {
  const weekStart = mondayOfThisWeek()

  const { data: plan, error } = await admin
    .from('week_plan')
    .insert({ household_id: householdId, week_start: weekStart })
    .select('id')
    .single()
  if (error !== null) throw new Error(`Week Plan: ${error.message}`)
  const weekPlanId = (plan as { id: string }).id

  const { data: meals } = await admin.from('meal').select('id,name').eq('household_id', householdId)
  const byName = new Map((meals as { id: string; name: string }[]).map((m) => [m.name, m.id]))
  const mealId = (name: string): string => {
    const id = byName.get(name)
    if (id === undefined) throw new Error(`Seed expects a Meal named ${name}`)
    return id
  }

  // Covers every board state: a normal day, two Meals in one Slot, a Leftover,
  // and empty Slots.
  const { data: events, error: eventError } = await admin
    .from('cook_event')
    .insert([
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Munavoileivät'),
        date: weekStart,
        slot_key: 'lunch',
        servings_cooked: 2,
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Chili con carne'),
        date: weekStart,
        slot_key: 'dinner',
        servings_cooked: 6,
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Uunilohi ja perunamuusi'),
        date: addDays(weekStart, 1),
        slot_key: 'dinner',
        servings_cooked: 3,
      },
      {
        week_plan_id: weekPlanId,
        meal_id: mealId('Tacos'),
        date: addDays(weekStart, 1),
        slot_key: 'dinner',
        servings_cooked: 2,
      },
    ])
    .select('id,meal_id')
  if (eventError !== null) throw new Error(`Cook Events: ${eventError.message}`)

  const chiliEvent = (events as { id: string; meal_id: string }[]).find(
    (e) => e.meal_id === mealId('Chili con carne'),
  )
  if (chiliEvent === undefined) throw new Error('Seed failed to create the Chili Cook Event')

  const { error: leftoverError } = await admin.from('leftover').insert({
    cook_event_id: chiliEvent.id,
    date: addDays(weekStart, 2),
    slot_key: 'lunch',
  })
  if (leftoverError !== null) throw new Error(`Leftover: ${leftoverError.message}`)

  process.stdout.write(`Seeded Week Plan for ${weekStart}\n`)
}
```

Call `await seedWeek(householdId)` at the end of `seed()`.

- [ ] **Step 8: Migrate, seed, and look at it**

```bash
cat supabase/schemas/30_planning.sql supabase/schemas/92_policies_planning.sql \
    > supabase/migrations/20260908000003_planning.sql
```

Add the temporary anon-read policies to the demo migration:

```sql
create policy week_plan_demo_anon_select on week_plan for select to anon using (true);
create policy cook_event_demo_anon_select on cook_event for select to anon using (true);
create policy leftover_demo_anon_select on leftover for select to anon using (true);
```

```bash
pnpm exec supabase db reset
pnpm run db:seed
pnpm run start
```

Check the board shows the same week it showed in Task 3 — but now from Postgres.
Then prove the cascade is real:

```bash
psql "$(pnpm exec supabase status -o env | grep DB_URL | cut -d= -f2-)" -c \
  "delete from cook_event where meal_id = (select id from meal where name = 'Chili con carne')"
```

Pull to refresh, or restart. Expected: **Monday dinner's Chili is gone and
Wednesday lunch's Leftover has gone with it.** That is ADR 0004 working in the
real system.

Restore with `pnpm run db:seed`.

- [ ] **Step 9: Validate and commit**

```bash
pnpm run validate
git add -A
git commit -m "feat(planning): Week Plan, Cook Event and Leftover schema; board reads live data

- Leftovers cascade from their Cook Event so none can be stranded (ADR 0004)
- No uniqueness on (date, slot_key): two Meals on Tuesday dinner is supported
- week_start constrained to a Monday
- Fixtures deleted; useWeekBoard reads Postgres through TanStack Query"
```

---

### Task 8: CI and the E2E smoke flow

**Deliverable:** tooling. Every gate runs on every PR as a parallel job, and one
E2E flow proves the board renders on a real device.

**Files:**

- Create: `.github/workflows/validate.yml`, `.maestro/board-smoke.yaml`
- Modify: `package.json`, `docs/08-deployment.md`

**Interfaces:**

- Consumes: `pnpm run validate` (Tasks 1, 4)
- Produces: CI mirroring local gates

- [ ] **Step 1: The workflow**

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
        step:
          - format:check
          - lint
          - lint:boundaries
          - lint:duplication
          - type-check
          - test
          - build
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: ppnpm add --frozen-lockfile
      - run: pnpm run ${{ matrix.step }}
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: failure-${{ matrix.step }}
          path: |
            coverage/
            pnpm-debug.log
          if-no-files-found: ignore

  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: ppnpm add --frozen-lockfile
      - run: pnpm audit --audit-level=high
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`fail-fast: false` is deliberate: one failing gate must not hide the others. You
want every problem from one push, not one problem per push.

- [ ] **Step 2: The E2E flow**

Create `.maestro/board-smoke.yaml`:

```yaml
# Requires a seeded local Supabase (pnpm run db:seed). The date assertions are
# relative because the seed always plans the current week.
appId: com.mealplanner.app
---
- launchApp
- assertVisible:
    id: 'board-screen'
- assertVisible:
    id: 'board'
- assertVisible: 'Koivisto'
- assertVisible:
    id: 'slot-dinner'
```

Add script: `"test:e2e": "maestro test .maestro"`.

This asserts on `testID`s, never on CSS classes or structural position, per
`docs/04-testing.md`. The one text assertion is a Household name from the seed,
which is not translated.

- [ ] **Step 3: Run it**

```bash
pnpm run db:seed
pnpm run test:e2e
```

Expected: PASS. If Maestro is not installed, note it in the commit message as a
developer-machine prerequisite rather than skipping the flow.

- [ ] **Step 4: Update the deployment doc**

Add to `docs/08-deployment.md` under CI: the matrix runs each gate as a parallel
job with `fail-fast: false`; `pnpm audit` and gitleaks run on every PR; artifacts
upload on failure.

Add to `docs/06-security.md` under Authorization a note that
`20260908000001_demo_anon_read.sql` exists only for local demonstration, expires
when sign-in lands in plan 02, and must never be applied to staging or
production.

- [ ] **Step 5: Validate and commit**

```bash
pnpm run validate
git add -A
git commit -m "ci(repo): parallel quality gates, dependency and secret scanning, E2E smoke"
```

---

## Self-Review

**Spec coverage.** Against `docs/01-functional-spec.md`: Household, Member,
Locale (Task 5) ✓; configurable Slots, order preserved, orphan tolerated
(Tasks 3, 5) ✓; Ingredient with slug identity and per-Locale names (Task 6) ✓;
Meal, Catalogue Meal, copy provenance column (Task 6) ✓; Meals with no
Ingredients (Task 6) ✓; Week Plan, Backlog Item, Cook Event, Leftover with
cascade (Task 7) ✓; board with non-exclusive Slots and empty-Slot affordance
(Tasks 3, 7) ✓; four card variants (Task 2) ✓; RLS as sole authorization point
(Tasks 5, 6, 7) ✓; both Locales with Household override (Tasks 2, 5) ✓; semantic
theme tokens (Task 2) ✓; test diamond with pglite (Tasks 5–7) ✓; all ten rules
gated (Tasks 1, 4) ✓.

**Deliberately out of scope**, carried by later plans: Backlog interaction and
placement (02), Meal editor and catalogue copy flow (03), Shopping List and
Staples (04), catalogue content (05), realtime and offline (06), wide-screen
panes (07). Sign-in is in 02.

**Known temporary code**, each flagged in place with its expiry rather than
hidden: the `*_demo_anon_select` policies in
`20260908000001_demo_anon_read.sql`, which exist because sign-in does not land
until plan 02, are recorded in `docs/06-security.md` and must be dropped there.
`src/features/planning/fixtures/demo-week.ts` is created in Task 3 and deleted
in Task 7 — the ~40 lines of throwaway that buy a working board four tasks
earlier.

**Type consistency.** `HouseholdId`, `MemberId`, `SlotKey`, `Locale`, `Slot`,
`Household`, `Member` (Task 3) are consumed unchanged by Tasks 5, 6, 7.
`MealId`, `Servings`, `Quantity`, `Meal`, `HouseholdRef` (Task 2) are consumed
by Tasks 3, 6, 7. `CookEvent`, `Leftover`, `BoardCard`, `WeekStart`,
`CookEventId`, `LeftoverId` (Task 3) are consumed by Tasks 3 and 7. `BoardDay`,
`BoardSlot`, `BuildBoardInput` (Task 3) are consumed by Tasks 3 and 7. `Result`,
`ok`, `err`, `isOk`, `isErr`, `Clock`, `fixedClock`, `systemClock`, `tokens`,
`memberColours` (Task 2) are consumed throughout. `createTestDb`, `TestDb`,
`asMember` (Task 5) are consumed by Tasks 6 and 7. `useWeekBoard` keeps the same
`WeekBoard` return type across its three implementations in Tasks 3, 5 and 7.
