import type { Scheme } from './palette'

/**
 * What the person chose, which is not the same as which palette is drawn.
 * `system` is the one that defers to the device; the other two override it.
 */
export type SchemeChoice = Scheme | 'system'

/**
 * Light unless something says otherwise, and the device does not count as
 * something saying otherwise.
 *
 * The board is a sheet of warm paper and that is the design; a phone left in
 * dark mode should not silently change what the app looks like for a family
 * that never asked. Dark is a choice made in Settings, and `system` is there
 * for the people who do want to be asked once and never again.
 */
export const resolveScheme = (input: {
  /** Pinned from above — Storybook, and the component tests. */
  readonly pinned?: Scheme | undefined
  readonly choice: SchemeChoice
  readonly device: Scheme
}): Scheme => {
  if (input.pinned !== undefined) return input.pinned
  if (input.choice === 'system') return input.device
  return input.choice
}

export const DEFAULT_SCHEME_CHOICE: SchemeChoice = 'light'
