import { lightColours, lightShadows } from './palette'

/**
 * Translated from the Claude Design canvas (docs/07-design-system.md).
 *
 * Colours live in `palette.ts`, which holds both schemes under the same
 * semantic names; this is the light one, and the default a component gets
 * without a theme above it. Everything else here — type, space, radius — is
 * the same in the dark.
 */
/** Loaded by expo-font in the root layout; the fallbacks matter for the moment
 *  before they are ready and on web before the face is fetched. */
const FONT = {
  serif: 'InstrumentSerif-Regular, Georgia, serif',
  sans: 'InstrumentSans-Variable, system-ui, sans-serif',
} as const

export const tokens = {
  color: lightColours,
  /**
   * Two families, clearly distinct: a serif that carries the personality on
   * week and day headings, and a sans for everything a person reads quickly.
   * Body text never goes below 15px and shopping rows sit at 19px, because
   * both are read at arm's length.
   */
  type: {
    display: { fontFamily: FONT.serif, fontSize: 34, lineHeight: 36, letterSpacing: -0.5 },
    /** A day on the phone board, and a pane title. */
    dayHeading: { fontFamily: FONT.serif, fontSize: 22, lineHeight: 26 },
    sheetTitle: { fontFamily: FONT.serif, fontSize: 28, lineHeight: 32 },
    /** The app's name, set above the title on every way in. */
    wordmark: { fontFamily: FONT.serif, fontSize: 24, lineHeight: 28, letterSpacing: -0.3 },
    /** A planned Meal on the phone board: the largest thing on the card. */
    mealNameLarge: {
      fontFamily: FONT.sans,
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 23,
    },
    mealName: { fontFamily: FONT.sans, fontSize: 17, fontWeight: '600' as const, lineHeight: 21 },
    /** A Backlog card, and a row in the library pane. */
    mealNameSmall: {
      fontFamily: FONT.sans,
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    /** A card inside a wide-screen day column, where seven must fit across. */
    mealNameTight: {
      fontFamily: FONT.sans,
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 18,
    },
    body: { fontFamily: FONT.sans, fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
    /** "Cooking 6", "Added by Dad" — the second line of a card. */
    support: { fontFamily: FONT.sans, fontSize: 14, fontWeight: '400' as const, lineHeight: 19 },
    /** Provenance, hints, the count under a tight card. */
    meta: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
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
    /** A day heading in a wide column, and a section label inside a pane. */
    labelSmall: {
      fontFamily: FONT.sans,
      fontSize: 11,
      fontWeight: '700' as const,
      letterSpacing: 1.1,
    },
    /** The Slot label inside a wide column: present, never competing. */
    labelTiny: {
      fontFamily: FONT.sans,
      fontSize: 10,
      fontWeight: '600' as const,
      letterSpacing: 1,
    },
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  /**
   * The widest a column of text is allowed to get. Without it the Shopping
   * List stretched the full 1400px of a laptop and the name sat a screen's
   * width from its quantity: the eye has to travel from one to the other for
   * every line, and this is a list read while pushing a trolley.
   */
  layout: { readable: 720 },
  radius: { sm: 8, md: 10, card: 14, pill: 20, sheet: 26 },
  /**
   * Elevation says what kind of object this is: a planned Meal is raised off
   * the paper, a Backlog card barely, a dragged card clearly.
   */
  shadow: lightShadows,
} as const

/**
 * Member avatar colours, in the canvas's own order. Deliberately excludes
 * `backlog` amber, which means "wanted but unplanned" and must not be diluted
 * by appearing on a person.
 */
export const memberColours = ['#5F7355', '#C05A38', '#8A8172', '#4A6670'] as const
