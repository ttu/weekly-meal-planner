import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'

/**
 * The link, and the thing the link is not.
 *
 * The link is a seat on the board: whoever opens it is a Member until an admin
 * removes them. The panel says so, because a link in a group chat is easy to
 * forward (ADR 0013).
 */
type Props = {
  readonly visible: boolean
  /** Empty while the invite is being made. */
  readonly url: string
  readonly failed?: boolean | undefined
  readonly justCopied: boolean
  readonly onCopy: () => void
  readonly onClose: () => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 22,
      gap: tokens.space.md,
    },
    title: { ...tokens.type.sheetTitle, color: tokens.color.textPrimary },
    /** The link itself, sized to be read aloud over a phone if it comes to it. */
    linkBox: {
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      borderRadius: tokens.radius.md,
      padding: tokens.space.md,
    },
    link: { ...tokens.type.meta, color: tokens.color.textPrimary },
    note: { ...tokens.type.body, color: tokens.color.textMuted },
    copy: {
      backgroundColor: tokens.color.action,
      borderRadius: tokens.radius.card,
      paddingVertical: 17,
      alignItems: 'center',
    },
    copyPressed: { backgroundColor: tokens.color.actionPressed },
    copyText: { ...tokens.type.mealName, color: tokens.color.onAction },
    close: { alignSelf: 'center', paddingVertical: tokens.space.md },
    closeText: { ...tokens.type.body, fontWeight: '600', color: tokens.color.textMuted },
  }),
)

export const ShareSheet = ({
  visible,
  url,
  failed = false,
  justCopied,
  onCopy,
  onClose,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const creating = url === '' ? t('board.shareCreating') : url
  const shown = failed ? t('board.shareFailed') : creating

  return (
    <Sheet
      visible={visible}
      onDismiss={onClose}
      dismissLabel={t('board.shareClose')}
      contentStyle={[styles.content, { paddingBottom: insets.bottom + tokens.space.md }]}
      testID="share-sheet"
    >
      <Text style={styles.title}>{t('board.share')}</Text>

      <View style={styles.linkBox}>
        <Text style={styles.link} selectable testID="share-link">
          {shown}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.copy, pressed && styles.copyPressed]}
        disabled={url === ''}
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={t('board.shareCopy')}
        testID="share-copy"
      >
        <Text style={styles.copyText}>
          {justCopied ? t('board.shareCopied') : t('board.shareCopy')}
        </Text>
      </Pressable>

      <Text style={styles.note}>{t('board.shareBody')}</Text>

      <Pressable
        style={styles.close}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('board.shareClose')}
        testID="share-close"
      >
        <Text style={styles.closeText}>{t('board.shareClose')}</Text>
      </Pressable>
    </Sheet>
  )
}
