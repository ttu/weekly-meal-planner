import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'

/**
 * The two states that are neither content nor "nothing here".
 *
 * A screen has four: loading, failed, empty and ready. Drawing the first two
 * as the third tells a Member that their week has no Meals, or the list has
 * nothing to buy, because the signal dropped — and invites them to start
 * again over the top of what is really there.
 */
const sheets = themed((tokens) =>
  StyleSheet.create({
    box: { padding: tokens.space.md, gap: tokens.space.sm },
    text: { ...tokens.type.body, color: tokens.color.textSupport },
    button: {
      alignSelf: 'flex-start',
      paddingVertical: tokens.space.sm,
      paddingHorizontal: tokens.space.md,
      borderRadius: tokens.radius.md,
      backgroundColor: tokens.color.action,
    },
    buttonText: { ...tokens.type.mealNameSmall, color: tokens.color.onAction },
  }),
)

export const Loading = ({ testID }: { readonly testID?: string }): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.box} accessibilityLiveRegion="polite" testID={testID ?? 'loading'}>
      <Text style={styles.text}>{t('load.loading')}</Text>
    </View>
  )
}

type LoadErrorProps = {
  readonly onRetry: () => void
  readonly testID?: string
}

export const LoadError = ({ onRetry, testID }: LoadErrorProps): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.box} accessibilityRole="alert" testID={testID ?? 'load-error'}>
      <Text style={styles.text}>{t('load.failed')}</Text>
      <Pressable
        style={styles.button}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t('load.retry')}
        testID={`${testID ?? 'load-error'}-retry`}
      >
        <Text style={styles.buttonText}>{t('load.retry')}</Text>
      </Pressable>
    </View>
  )
}
