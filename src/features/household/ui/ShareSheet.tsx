import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaPadding } from '@/shared/theme/safe-area-padding'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'

/**
 * The link, and the thing the link is not.
 *
 * Sharing used to put the URL on the clipboard and say nothing, so a recipient
 * was sent half of what they needed and the sharer was never told. The panel
 * shows the link to copy and, beside it, that the password travels separately.
 *
 * It cannot show the password. Only the bcrypt hash is kept (ADR 0010) — the
 * plaintext lives in the head of whoever chose it, which is the point.
 */
type Props = {
  readonly visible: boolean
  readonly url: string
  readonly justCopied: boolean
  readonly onCopy: () => void
  readonly onClose: () => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    /** The part of the backdrop above the sheet: pressing it closes. */
    dismiss: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: tokens.color.scrim, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: tokens.color.surface,
      borderTopLeftRadius: tokens.radius.sheet,
      borderTopRightRadius: tokens.radius.sheet,
      paddingHorizontal: 22,
      paddingTop: 22,
      gap: tokens.space.md,
      width: '100%',
      maxWidth: tokens.layout.readable,
      alignSelf: 'center',
    },
    grip: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: tokens.color.dashed,
      alignSelf: 'center',
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
  justCopied,
  onCopy,
  onClose,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()
  const sheetPadding = useSafeAreaPadding({ bottom: tokens.space.md })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismiss}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('board.shareClose')}
        />
        <View style={[styles.sheet, sheetPadding]} testID="share-sheet">
          <View style={styles.grip} />
          <Text style={styles.title}>{t('board.share')}</Text>

          <View style={styles.linkBox}>
            <Text style={styles.link} selectable testID="share-link">
              {url}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.copy, pressed && styles.copyPressed]}
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
          <Text style={[styles.note, tokens.type.meta]}>{t('board.sharePasswordNote')}</Text>

          <Pressable
            style={styles.close}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('board.shareClose')}
            testID="share-close"
          >
            <Text style={styles.closeText}>{t('board.shareClose')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
