import { StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'

/**
 * Something went wrong, said where it can be seen.
 *
 * These messages used to be laid out in the page flow, which on the wide board
 * put them below the footer rail — off the bottom of the window, behind the
 * dev badge, where a failed plan reported itself to nobody. A floating banner
 * belongs to the window rather than the column, so it cannot be pushed out of
 * sight by whatever is above it.
 */
type Props = {
  readonly message: string
  readonly testID?: string | undefined
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    layer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: tokens.space.lg,
      alignItems: 'center',
      pointerEvents: 'none',
      zIndex: 900,
    },
    banner: {
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.action,
      borderRadius: tokens.radius.md,
      paddingVertical: 12,
      paddingHorizontal: tokens.space.md,
      marginHorizontal: tokens.space.md,
      maxWidth: tokens.layout.readable,
      boxShadow: tokens.shadow.lifted,
    },
    text: { ...tokens.type.body, color: tokens.color.action },
  }),
)

export const Notice = ({ message, testID }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)

  return (
    <View style={styles.layer} accessibilityLiveRegion="polite">
      <View style={styles.banner} testID={testID}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  )
}
