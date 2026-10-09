/**
 * The two palettes, under one set of semantic names.
 *
 * The light one is the canvas, unchanged. The dark one is derived from it
 * rather than invented: warm near-black grounds in place of warm paper, so a
 * board opened at 10pm is the same object seen in a different light, not a
 * different product.
 *
 * Three decisions are worth stating, because the design system asked for them
 * by name:
 *
 * - **Amber is the one that nearly failed.** `backlog` carries meaning —
 *   wanted but unplanned — and the canvas's #E8B04B on a dark ground reads as
 *   a highlighter. It is lifted to a paler, less saturated gold, which keeps
 *   the hue and the ~8:1 contrast against the dark paper.
 * - **Terracotta is lifted too.** The action colour has to stay readable as
 *   text on dark paper, which #C05A38 is not; #D97757 is the same hue with
 *   the lightness a dark ground needs.
 * - **Elevation inverts.** On paper a raised card is whiter than its ground;
 *   in the dark it is lighter than its ground. Shadows go nearly black, since
 *   a shadow on a dark surface is read from its edge, not its weight.
 *
 * The light palette was the canvas, taken unchanged, and it had never been
 * measured. Seven of its colours failed the WCAG AA contrast the design system
 * commits to (docs/07-design-system.md) and `contrast.test.ts` now holds every
 * one of them to it. Amber was the one the design system predicted would fail,
 * and at 1.75:1 on paper it failed worst: it is the sole carrier of
 * "wanted but unplanned", so it is darkened to an ochre that keeps the hue and
 * clears the 3:1 a meaningful graphic needs.
 *
 * One honest casualty: `textSupport` and `textGhost` used to be two visibly
 * different tiers. AA leaves about a tenth of a contrast step between them on
 * this paper, so they now read nearly alike, and the hierarchy they used to
 * carry has to come from size and weight instead.
 */
export type Colours = {
  readonly surface: string
  readonly surfaceSunken: string
  readonly surfaceRaised: string
  readonly surfaceInset: string
  readonly surfacePane: string
  readonly textPrimary: string
  readonly textMuted: string
  readonly textSupport: string
  readonly textGhost: string
  readonly rule: string
  readonly cardBorder: string
  readonly cardDivider: string
  readonly dashed: string
  readonly dashedInset: string
  readonly action: string
  readonly actionPressed: string
  readonly affirm: string
  readonly backlog: string
  /** Text on top of `action` and `affirm`. White on paper; near-black in the
   *  dark, where both colours are lifted and carry dark text better. */
  readonly onAction: string
  /** The same, at the weight of a supporting line. */
  readonly onActionMuted: string
  /** On a Member's avatar. Member colours are fixed hues in both schemes, so
   *  this does not move. */
  readonly onAvatar: string
  /** Something done with: a ticked Buy Line, a day that already has a Meal. */
  readonly textDone: string
  /** Behind a sheet. */
  readonly scrim: string
  /** A drop target under a dragged card. */
  readonly dropTint: string
  /** Today's column on the wide board, and its edge when it has just changed. */
  readonly todayTint: string
  readonly todayEdge: string
}

export type Shadows = {
  readonly card: string
  readonly subtle: string
  readonly lifted: string
  readonly shelf: string
}

export const lightColours: Colours = {
  surface: '#F7F2E9',
  surfaceSunken: '#EDE6D9',
  surfaceRaised: '#FFFFFF',
  surfaceInset: '#EFE8DA',
  surfacePane: '#FBF8F1',
  textPrimary: '#24211C',
  textMuted: '#6B6459',
  textSupport: '#756C5E',
  textGhost: '#776E60',
  rule: '#DBD2C1',
  cardBorder: '#E2D9C9',
  cardDivider: '#EFE8DA',
  dashed: '#968970',
  dashedInset: '#8E8170',
  action: '#B04E2E',
  actionPressed: '#9C4529',
  affirm: '#5F7355',
  backlog: '#B07D1A',
  onAction: '#FFFFFF',
  onActionMuted: 'rgba(255, 255, 255, 0.75)',
  onAvatar: '#FFFFFF',
  textDone: '#8F8674',
  scrim: 'rgba(36, 33, 28, 0.36)',
  dropTint: 'rgba(192, 90, 56, 0.06)',
  todayTint: 'rgba(95, 115, 85, 0.05)',
  todayEdge: 'rgba(95, 115, 85, 0.35)',
}

export const darkColours: Colours = {
  surface: '#191714',
  surfaceSunken: '#131110',
  surfaceRaised: '#262320',
  surfaceInset: '#201E1A',
  surfacePane: '#1E1C19',
  textPrimary: '#F2EDE3',
  textMuted: '#B6AD9D',
  textSupport: '#938A7B',
  textGhost: '#948B7B',
  rule: '#39352F',
  cardBorder: '#333029',
  cardDivider: '#2B2823',
  dashed: '#767060',
  dashedInset: '#7E7768',
  action: '#D97757',
  actionPressed: '#E89272',
  affirm: '#8FA885',
  backlog: '#F0C572',
  onAction: '#1A1613',
  onActionMuted: 'rgba(26, 22, 19, 0.7)',
  onAvatar: '#FFFFFF',
  textDone: '#787160',
  scrim: 'rgba(0, 0, 0, 0.6)',
  dropTint: 'rgba(217, 119, 87, 0.14)',
  todayTint: 'rgba(143, 168, 133, 0.08)',
  todayEdge: 'rgba(143, 168, 133, 0.4)',
}

export const lightShadows: Shadows = {
  card: '0 2px 6px rgba(36, 33, 28, 0.06)',
  subtle: '0 1px 3px rgba(36, 33, 28, 0.06)',
  lifted: '0 6px 16px rgba(36, 33, 28, 0.14)',
  shelf: '0 -6px 20px rgba(36, 33, 28, 0.06)',
}

export const darkShadows: Shadows = {
  card: '0 2px 6px rgba(0, 0, 0, 0.45)',
  subtle: '0 1px 3px rgba(0, 0, 0, 0.4)',
  lifted: '0 6px 16px rgba(0, 0, 0, 0.6)',
  shelf: '0 -6px 20px rgba(0, 0, 0, 0.45)',
}

export type Scheme = 'light' | 'dark'

export const coloursFor = (scheme: Scheme): Colours =>
  scheme === 'dark' ? darkColours : lightColours

export const shadowsFor = (scheme: Scheme): Shadows =>
  scheme === 'dark' ? darkShadows : lightShadows
