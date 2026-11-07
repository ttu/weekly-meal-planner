import { View } from 'react-native'
import { radioKeyTarget } from './radioKeys'
import type { RadioGroupProps } from './RadioGroup'

/** Takes no box of its own: the View inside keeps the layout. */
const passThrough = { display: 'contents' } as const

/**
 * The web radiogroup. react-native-web activates only buttons with Space and
 * gives radios no arrow keys, and View has no onKeyDown in its types, so the
 * keys are caught on a layout-less div around the group. Pairs with
 * `rovingTabIndex` on each option, which keeps one Tab stop per group.
 */
export const RadioGroup = ({ label, style, children }: RadioGroupProps): React.JSX.Element => {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'))
    const index = radios.findIndex((radio) => radio === event.target)
    if (index === -1) return
    const next = radios[radioKeyTarget(event.key, index, radios.length) ?? -1]
    if (next === undefined) return
    event.preventDefault()
    next.focus()
    next.click()
  }

  return (
    <div style={passThrough} onKeyDown={onKeyDown}>
      <View accessibilityRole="radiogroup" aria-label={label} style={style}>
        {children}
      </View>
    </div>
  )
}
