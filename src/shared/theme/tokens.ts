/**
 * Translated from the Claude Design canvas (docs/07-design-system.md).
 * Names are semantic, not literal, so the undesigned dark theme is a value swap
 * rather than a refactor.
 */
/** Loaded by expo-font in the root layout; the fallbacks matter for the moment
 *  before they are ready and on web before the face is fetched. */
const FONT = {
  serif: 'InstrumentSerif-Regular, Georgia, serif',
  sans: 'InstrumentSans-Variable, system-ui, sans-serif',
} as const

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
  /**
   * Two families, clearly distinct: a serif that carries the personality on
   * week and day headings, and a sans for everything a person reads quickly.
   * Body text never goes below 15px and shopping rows sit at 19px, because
   * both are read at arm's length.
   */
  type: {
    display: { fontFamily: FONT.serif, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
    dayHeading: { fontFamily: FONT.serif, fontSize: 24, lineHeight: 28 },
    mealName: { fontFamily: FONT.sans, fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
    body: { fontFamily: FONT.sans, fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
    shoppingRow: {
      fontFamily: FONT.sans,
      fontSize: 19,
      fontWeight: '400' as const,
      lineHeight: 25,
    },
    label: {
      fontFamily: FONT.sans,
      fontSize: 12,
      fontWeight: '600' as const,
      letterSpacing: 1.4,
    },
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
} as const

/**
 * Member avatar colours. Deliberately excludes `backlog` amber, which means
 * "wanted but unplanned" and must not be diluted by appearing on a person.
 */
export const memberColours = ['#5F7355', '#C05A38', '#4A6670', '#7A5C74'] as const
