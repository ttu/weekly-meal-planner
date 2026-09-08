/**
 * Translated from the Claude Design canvas (docs/07-design-system.md).
 * Names are semantic, not literal, so the undesigned dark theme is a value swap
 * rather than a refactor.
 */
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

/**
 * Member avatar colours. Deliberately excludes `backlog` amber, which means
 * "wanted but unplanned" and must not be diluted by appearing on a person.
 */
export const memberColours = ['#5F7355', '#C05A38', '#4A6670', '#7A5C74'] as const
