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
