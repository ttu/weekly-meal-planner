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
  {
    files: [
      'src/**/*.ts',
      'src/**/*.tsx',
      '.storybook/**/*.ts',
      '.storybook/**/*.tsx',
      'scripts/**/*.ts',
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
    // The flat config itself: lint it, but without type information.
    files: ['eslint.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
])
