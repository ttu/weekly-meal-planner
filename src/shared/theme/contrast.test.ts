import { darkColours, lightColours, type Colours } from './palette'

/**
 * The design system commits to WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large
 * text and for graphics that carry meaning (docs/07-design-system.md).
 *
 * This exists because the light palette was adopted from the canvas without
 * anyone measuring it, and seven of its colours were below the line — the
 * amber Backlog edge worst of all, at 1.75:1, which the design system had
 * predicted in writing and nothing checked.
 */
const channel = (hex: string, at: number): number => {
  const value = parseInt(hex.slice(at, at + 2), 16) / 255
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
}

const luminance = (hex: string): number => {
  const h = hex.replace('#', '')
  return 0.2126 * channel(h, 0) + 0.7152 * channel(h, 2) + 0.0722 * channel(h, 4)
}

export const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)]
  const [hi, lo] = x > y ? [x, y] : [y, x]
  return (hi + 0.05) / (lo + 0.05)
}

/** Every ground a Member reads text against. */
const grounds = (c: Colours): readonly [string, string][] => [
  ['paper', c.surface],
  ['raised card', c.surfaceRaised],
  ['pane', c.surfacePane],
]

const bodyText = (c: Colours): readonly [string, string][] => [
  ['textPrimary', c.textPrimary],
  ['textMuted', c.textMuted],
  ['textSupport', c.textSupport],
  ['textGhost', c.textGhost],
]

describe.each([
  ['light', lightColours],
  ['dark', darkColours],
])('%s palette', (_name, colours) => {
  describe.each(grounds(colours))('on %s', (_groundName, ground) => {
    it.each(bodyText(colours))('%s is readable as body text', (_token, colour) => {
      expect(contrast(colour, ground)).toBeGreaterThanOrEqual(4.5)
    })

    // The action colour is read as text ("+ New meal", "Cancel") as often as
    // it is sat behind white.
    it('action is readable as text', () => {
      expect(contrast(colours.action, ground)).toBeGreaterThanOrEqual(4.5)
    })

    it('affirm is readable as text', () => {
      expect(contrast(colours.affirm, ground)).toBeGreaterThanOrEqual(4.5)
    })

    // Amber is not decoration: it is the whole of "wanted but unplanned".
    it('the Backlog amber clears the bar a meaningful graphic has to', () => {
      expect(contrast(colours.backlog, ground)).toBeGreaterThanOrEqual(3)
    })

    // The dashed outline is the only invitation an empty Slot makes.
    it('the empty-Slot outline is visible', () => {
      expect(contrast(colours.dashed, ground)).toBeGreaterThanOrEqual(3)
    })
  })

  it('text on the action colour is readable', () => {
    expect(contrast(colours.onAction, colours.action)).toBeGreaterThanOrEqual(4.5)
  })

  it('text on the affirm colour is readable', () => {
    expect(contrast(colours.onAction, colours.affirm)).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * A ticked Buy Line is an inactive state, which WCAG 1.4.3 exempts, and the
   * strike-through carries the meaning without relying on colour. It is still
   * held to the 3:1 a large or disabled label needs, because it is read in a
   * shop.
   */
  it('a ticked line stays legible', () => {
    expect(contrast(colours.textDone, colours.surfaceRaised)).toBeGreaterThanOrEqual(3)
  })
})
