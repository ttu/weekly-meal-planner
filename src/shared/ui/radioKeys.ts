/**
 * The keyboard of a radiogroup (WAI-ARIA APG): arrows move the choice and
 * wrap, Space picks the focused option. Returns the index to focus and pick,
 * or undefined for a key the group does not handle.
 */
export const radioKeyTarget = (key: string, index: number, count: number): number | undefined => {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count
    case ' ':
      return index
    default:
      return undefined
  }
}

/** One Tab stop per group: the chosen option, or the first while none is. */
export const rovingTabIndex = (index: number, selectedIndex: number): 0 | -1 =>
  index === Math.max(selectedIndex, 0) ? 0 : -1
