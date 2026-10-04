import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import sonarjs from 'eslint-plugin-sonarjs'
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
      'storybook-static/**',
      'expo-env.d.ts',
      '*.config.js',
      '*.cjs',
      'src/shared/db/database.types.ts',
      'jest.setup.node.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  sonarjs.configs.recommended,
  {
    rules: {
      // `TODO.md` is this project's issue tracker and the code points at it by
      // name. A reminder that says where the work is tracked is the convention
      // here, not a defect.
      'sonarjs/todo-tag': 'off',
      // Redundant with @typescript-eslint/no-unused-vars from
      // strictTypeChecked, which is type-aware; two reports per unused name
      // teaches people to tune the linter out.
      'sonarjs/no-unused-vars': 'off',

      // On beyond the recommended set. All of these were already clean when
      // they were turned on, so each is a ratchet rather than a backlog.

      // `.npmrc` sets node-linker=hoisted, so an undeclared package resolves
      // anyway and nothing notices until the tree is built differently. This
      // is the only thing that catches it.
      'sonarjs/no-implicit-dependencies': 'error',
      // Git history is the record of what was done, and TODO.md is the record
      // of what is left. Commented-out code is neither.
      'sonarjs/no-commented-code': 'error',
      // The return-position half of no-explicit-any, which is already an error.
      'sonarjs/no-return-type-any': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/useless-string-operation': 'error',
      'sonarjs/no-nested-switch': 'error',
    },
  },
  {
    // One assertion per `it`: a composite assertion that fails does not say
    // which half of it failed.
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**'],
    rules: { 'sonarjs/composite-assertions': 'error' },
  },
  {
    files: [
      'src/**/*.ts',
      'src/**/*.tsx',
      '.storybook/**/*.ts',
      '.storybook/**/*.tsx',
      'scripts/**/*.ts',
      'e2e/**/*.ts',
      'playwright.config.ts',
    ],
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
      '.storybook/**',
      'scripts/**',
      'e2e/**',
    ],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    plugins: { boundaries: (await import('eslint-plugin-boundaries')).default },
    settings: {
      // Without a TypeScript resolver an extensionless .tsx import cannot be
      // resolved, the target is classified "unknown", and every boundary rule
      // silently passes.
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app', partialMatch: true },
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'], partialMatch: true },
        { type: 'shared', pattern: 'src/shared', partialMatch: true },
        { type: 'test', pattern: 'src/test', partialMatch: true },
      ],
      // Font and image files are assets, not architectural elements.
      'boundaries/ignore': ['**/*.ttf', '**/*.png', '**/*.jpg', '**/*.svg'],
      'boundaries/files': [{ category: 'feature-public', pattern: 'src/features/*/index.ts' }],
    },
    rules: {
      'boundaries/no-unknown-dependencies': 'error',
      // Cross-feature access goes through index.ts and nothing else. A
      // feature's own files import each other freely (same captured feature).
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'feature' } },
              disallow: { to: { element: { type: 'feature' } } },
            },
            {
              from: { element: { type: 'feature' } },
              allow: { to: { file: { categories: 'feature-public' } } },
            },
            // shared/ is generic or it is not shared: it may never know a feature.
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { types: { anyOf: ['feature', 'app'] } } } },
            },
          ],
        },
      ],
    },
  },
  {
    // Fixtures, the demo seed and the e2e suite use literal fake credentials on
    // purpose: the demo logins are printed to the terminal for anyone to use,
    // and an invite token fixture has to look like a real one to be a useful
    // fixture. Nothing here is a secret that could leak.
    files: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/fixtures/**',
      'src/test/**',
      'scripts/**',
      'e2e/**',
    ],
    rules: {
      'sonarjs/no-hardcoded-secrets': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
    },
  },
  {
    // The e2e suite runs against a local Supabase container and dumps
    // screenshots under /tmp: `docker` comes off the developer's PATH and the
    // screenshot paths are throwaway. Neither is a production concern.
    files: ['e2e/**'],
    rules: {
      'sonarjs/no-os-command-from-path': 'off',
      'sonarjs/publicly-writable-directories': 'off',
      // Real debt, not a rule to keep off: the suite waits out animations and
      // the auto-scroll dwell with fixed sleeps. Replacing them with
      // observable conditions is a dedicated pass (see TODO.md) - doing it
      // alongside a lint-config change risks flakiness.
      'sonarjs/no-fixed-wait-in-tests': 'off',
      // `networkidle` is discouraged by Playwright itself and is the same
      // mistake as a fixed wait: a guess about timing dressed up as a wait.
      'sonarjs/no-networkidle-wait': 'error',
    },
  },
  {
    // The flat config itself: lint it, but without type information.
    files: ['eslint.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
])
