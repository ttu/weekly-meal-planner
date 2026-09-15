import { StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'

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

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: tokens.type.label.fontFamily, fontWeight: '600', color: '#FFFFFF' },
})

export const Avatar = ({ name, colour, size = 'medium', ringColour }: Props): React.JSX.Element => {
  const { box, font } = metrics[size]

  return (
    <View
      style={[
        styles.avatar,
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          backgroundColor: colour === '' ? tokens.color.textSupport : colour,
        },
        ringColour !== undefined && { borderWidth: 2, borderColor: ringColour },
      ]}
      accessibilityLabel={name}
    >
      <Text style={[styles.initial, { fontSize: font }]}>
        {(name.slice(0, 1) || '?').toUpperCase()}
      </Text>
    </View>
  )
}
