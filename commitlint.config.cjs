module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    // The glossary requires capitalised domain terms — "Household", "Cook
    // Event" — in every artefact, commit subjects included. The default
    // subject-case rule forbids exactly that, so it is off here.
    'subject-case': [0],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'style', 'chore', 'ci', 'build', 'perf'],
    ],
  },
}
