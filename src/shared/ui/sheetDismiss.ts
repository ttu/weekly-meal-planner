/** Distance, in points, past which letting go closes the sheet. */
export const DISMISS_DISTANCE = 80

/** Downward speed, in points per second, that closes it from a short flick. */
export const DISMISS_VELOCITY = 800

type Drag = { readonly translationY: number; readonly velocityY: number }

/**
 * Whether letting go of the grab handle should close the sheet: dragged far
 * enough, or flicked down fast. Upward movement never closes it.
 */
export const shouldDismiss = ({ translationY, velocityY }: Drag): boolean =>
  translationY > DISMISS_DISTANCE || (translationY > 0 && velocityY > DISMISS_VELOCITY)
