import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import type { DemoLink } from './demo-board'

type Props = {
  readonly isPending: boolean
  readonly failed: boolean
  /** Present once the demo board exists: one link per Member. */
  readonly links: readonly DemoLink[] | undefined
  readonly onSeed: () => void
  readonly onOpenBoard: () => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    panel: {
      borderTopWidth: 1,
      borderTopColor: tokens.color.rule,
      paddingTop: tokens.space.md,
      gap: tokens.space.sm,
    },
    title: { ...tokens.type.meta, fontWeight: '600', color: tokens.color.textMuted },
    hint: { ...tokens.type.meta, color: tokens.color.textSupport },
    link: {
      ...tokens.type.body,
      fontWeight: '600',
      color: tokens.color.action,
      textDecorationLine: 'underline',
    },
  }),
)

/**
 * Development only: one tap to a board with something on it, and a link per
 * Member to open it as them in another browser. The links hold each Member's
 * keys, so they are shown here and never logged.
 */
export const DemoBoardPanel = ({
  isPending,
  failed,
  links,
  onSeed,
  onOpenBoard,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()

  return (
    <View style={styles.panel} testID="demo-board-panel">
      <Text style={styles.title}>{t('dev.title')}</Text>
      {links === undefined ? (
        <>
          <Text style={styles.hint}>{t('dev.body')}</Text>
          {failed && <Text style={formStyles.error}>{t('dev.failed')}</Text>}
          <Pressable
            style={({ pressed }) => [formStyles.chip, pressed && formStyles.chipSelected]}
            disabled={isPending}
            aria-disabled={isPending}
            onPress={onSeed}
            accessibilityRole="button"
            accessibilityLabel={t('dev.seed')}
            testID="demo-board-seed"
          >
            <Text style={formStyles.chipText}>{isPending ? t('dev.seeding') : t('dev.seed')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.hint}>{t('dev.linksHint')}</Text>
          {links.map((link) => (
            // A new tab keeps this panel open; a private window keeps this browser Aino.
            <Link
              key={link.name}
              href={link.url}
              target="_blank"
              style={styles.link}
              testID={`demo-link-${link.name}`}
            >
              {t('dev.openAs', { name: link.name })}
            </Link>
          ))}
          <Pressable
            style={({ pressed }) => [formStyles.primary, pressed && formStyles.primaryPressed]}
            onPress={onOpenBoard}
            accessibilityRole="button"
            accessibilityLabel={t('dev.openBoard')}
            testID="demo-board-open"
          >
            <Text style={formStyles.primaryText}>{t('dev.openBoard')}</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}
