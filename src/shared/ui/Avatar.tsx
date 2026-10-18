import { useMemo } from 'react'
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'

/**
 * A Member, as a face. Who wanted a Meal and who planned it is the point of a
 * shared board, so the canvas puts the avatar on the card rather than behind a
 * tooltip.
 */
type Props = {
  readonly name: string
  readonly colour: string
  readonly size?: 'small' | 'medium' | 'large'
  /** Overlapping avatars in a presence stack need a ring to stay separable. */
  readonly ringColour?: string | undefined
}

const metrics = {
  small: { box: 20, font: 10 },
  medium: { box: 26, font: 12 },
  large: { box: 30, font: 12 },
} as const

const sizeSheet = (size: keyof typeof metrics): { box: ViewStyle; initial: TextStyle } => ({
  box: {
    width: metrics[size].box,
    height: metrics[size].box,
    borderRadius: metrics[size].box / 2,
  },
  initial: { fontSize: metrics[size].font },
})

const sheets = themed((tokens) =>
  StyleSheet.create({
    avatar: { alignItems: 'center', justifyContent: 'center' },
    ring: { borderWidth: 2 },
    smallBox: sizeSheet('small').box,
    mediumBox: sizeSheet('medium').box,
    largeBox: sizeSheet('large').box,
    smallInitial: sizeSheet('small').initial,
    mediumInitial: sizeSheet('medium').initial,
    largeInitial: sizeSheet('large').initial,
    initial: {
      fontFamily: tokens.type.label.fontFamily,
      fontWeight: '600',
      color: tokens.color.onAvatar,
    },
  }),
)

export const Avatar = ({ name, colour, size = 'medium', ringColour }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  // Member and ring colours are data, not tokens, so their sheet is built here.
  const colours = useMemo(
    () =>
      StyleSheet.create({
        fill: { backgroundColor: colour === '' ? theme.color.textSupport : colour },
        ring: { borderColor: ringColour },
      }),
    [colour, ringColour, theme.color.textSupport],
  )

  return (
    <View
      style={[
        styles.avatar,
        styles[`${size}Box`],
        colours.fill,
        ringColour !== undefined && styles.ring,
        ringColour !== undefined && colours.ring,
      ]}
      accessibilityLabel={name}
    >
      <Text style={[styles.initial, styles[`${size}Initial`]]}>
        {(name.slice(0, 1) || '?').toUpperCase()}
      </Text>
    </View>
  )
}
