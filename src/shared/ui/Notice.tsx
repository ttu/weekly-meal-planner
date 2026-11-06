import { Pressable, StyleSheet, Text, View } from 'react-native'
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
  /** One thing to do about it — "Try again". The banner floats over the page
   *  and ignores touches, so it takes them back only when it has a button. */
  readonly action?: { readonly label: string; readonly onPress: () => void } | undefined
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    layer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: tokens.space.lg,
      alignItems: 'center',
      // The layer spans the window; only the banner may take touches, and only
      // when it has a button. 'none' here would disable the button as well.
      pointerEvents: 'box-none',
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
    actionButton: { alignSelf: 'flex-start', paddingTop: tokens.space.sm },
    actionText: { ...tokens.type.mealNameSmall, color: tokens.color.action },
  }),
)

export const Notice = ({ message, testID, action }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)

  return (
    <View style={styles.layer} accessibilityLiveRegion="polite">
      <View
        style={styles.banner}
        testID={testID}
        pointerEvents={action === undefined ? 'none' : 'auto'}
      >
        <Text style={styles.text}>{message}</Text>
        {action !== undefined && (
          <Pressable
            style={styles.actionButton}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            testID={testID === undefined ? undefined : `${testID}-action`}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
