module.exports = {
  projects: [
    {
      displayName: 'node',
      modulePathIgnorePatterns: ['<rootDir>/.worktrees/', '<rootDir>/.claude/worktrees/'],
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
      modulePathIgnorePatterns: ['<rootDir>/.worktrees/', '<rootDir>/.claude/worktrees/'],
      preset: 'jest-expo',
      // Gesture Handler's native module does not exist under a test renderer;
      // its own setup file stands in for it.
      setupFiles: ['react-native-gesture-handler/jestSetup'],
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Reanimated 4 is ESM-only and drives a native animation thread, which
        // a test renderer cannot do. Mocked at the module boundary — a
        // third-party native library, not our own code — so components still
        // render real output.
        '^react-native-reanimated$': '<rootDir>/src/test/mocks/react-native-reanimated.tsx',
        '^react-native-worklets$': '<rootDir>/src/test/mocks/react-native-worklets.ts',
        '^@react-native-async-storage/async-storage$': '<rootDir>/src/test/mocks/async-storage.ts',
      },
    },
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
}
