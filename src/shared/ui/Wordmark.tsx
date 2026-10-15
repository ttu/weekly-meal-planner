import { StyleSheet, Text } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'

/**
 * The app's name, at the top of every screen someone sees before they are on
 * a board. An invite arrives as a bare link in a family chat; the first thing
 * it opens should say what it is.
 */
const sheets = themed((tokens) =>
  StyleSheet.create({
    wordmark: {
      ...tokens.type.wordmark,
      color: tokens.color.action,
      marginBottom: tokens.space.lg,
    },
  }),
)

export const Wordmark = (): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <Text style={styles.wordmark} testID="wordmark">
      {t('app.name')}
    </Text>
  )
}
