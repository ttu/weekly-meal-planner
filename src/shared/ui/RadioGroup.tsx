import { View, type StyleProp, type ViewStyle } from 'react-native'

export type RadioGroupProps = {
  /** What is being chosen, so each set of radios is told apart. */
  readonly label: string
  readonly style?: StyleProp<ViewStyle>
  readonly children: React.ReactNode
}

/**
 * A labelled set of `radio` options. On native the platform's own focus model
 * moves between them; RadioGroup.web.tsx adds the keyboard a browser lacks.
 */
export const RadioGroup = ({ label, style, children }: RadioGroupProps): React.JSX.Element => (
  <View accessibilityRole="radiogroup" aria-label={label} style={style}>
    {children}
  </View>
)
