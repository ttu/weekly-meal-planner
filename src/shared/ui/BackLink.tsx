import { Pressable, StyleSheet, Text } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'

/**
 * The way out of a screen that is not the board.
 *
 * On web the browser's back button covers this; on a phone there is none, and
 * the Shopping List and the Meal library had no way back at all.
 *
 * Takes the action rather than reaching for the router: routing belongs to the
 * route, and importing expo-router here drags an ESM-only dependency into
 * every component test that renders a screen.
 */
type Props = {
  readonly onPress: () => void
  /** Overrides "Back to the board" where there is no board behind you yet. */
  readonly label?: string | undefined
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'flex-start',
    paddingVertical: tokens.space.sm,
    paddingRight: tokens.space.md,
  },
  text: { ...tokens.type.support, color: tokens.color.textMuted },
})

export const BackLink = ({ onPress, label }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const text = label ?? t('nav.back')

  return (
    <Pressable
      style={styles.link}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={text}
      testID="back-link"
    >
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  )
}
