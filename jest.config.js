module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      transform: {
        // ts-jest emits CommonJS, which the app's verbatimModuleSyntax forbids.
        // tsconfig.jest.json relaxes exactly that, and nothing else.
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
      },
      testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/scripts/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.node.js'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'native',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Reanimated 4 is ESM-only and drives a native animation thread, which
        // a test renderer cannot do. Mocked at the module boundary — a
        // third-party native library, not our own code — so components still
        // render real output.
        '^react-native-reanimated$': '<rootDir>/src/test/mocks/react-native-reanimated.tsx',
      },
    },
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
}
