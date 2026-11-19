import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { Field } from '@/shared/ui/Field'
import { Wordmark } from '@/shared/ui/Wordmark'
import { useTranslation } from '@/shared/i18n'
import { KeyboardAvoiding } from '@/shared/ui/KeyboardAvoiding'

type Props = {
  readonly isPending: boolean
  /** Whether starting the board failed; there is nothing more to say than "try again". */
  readonly failed?: boolean | undefined
  readonly onCreate: (input: { boardName: string; displayName: string }) => void
  readonly onJoinInstead?: (() => void) | undefined
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    fieldTight: { marginBottom: tokens.space.xs },
    title: { ...tokens.type.display, color: tokens.color.textPrimary },
    body: { ...tokens.type.body, color: tokens.color.textMuted, marginBottom: tokens.space.lg },
    /** Under a field, saying what it is for rather than what it must contain. */
    hint: { ...tokens.type.meta, color: tokens.color.textSupport, marginBottom: tokens.space.md },
    /**
     * The one thing an anonymous board must say out loud: this device is the
     * only key. Tinted rather than red — it is a fact to absorb, not a failure.
     */
    keyNote: {
      flexDirection: 'row',
      gap: tokens.space.sm,
      backgroundColor: tokens.color.surfaceInset,
      borderRadius: tokens.radius.md,
      padding: tokens.space.md,
      marginTop: tokens.space.lg,
      marginBottom: tokens.space.md,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: tokens.color.backlog,
      marginTop: 7,
    },
    keyNoteText: { ...tokens.type.meta, color: tokens.color.textMuted, flex: 1 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.space.md,
      flexWrap: 'wrap',
      marginTop: tokens.space.md,
      marginBottom: tokens.space.lg,
    },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    muted: { ...tokens.type.meta, color: tokens.color.textSupport },
    link: { ...tokens.type.meta, fontWeight: '600', color: tokens.color.action },
  }),
)

/**
 * The first screen for someone with no board. It asks for two things and
 * nothing else — a board name and their own name. The family joins by invite
 * link (ADR 0013).
 */
export const StartBoardScreen = ({
  isPending,
  failed = false,
  onCreate,
  onJoinInstead,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [boardName, setBoardName] = useState('')
  const [displayName, setDisplayName] = useState('')

  return (
    <KeyboardAvoiding>
      <ScrollView
        style={formStyles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[formStyles.content, { paddingTop: insets.top + tokens.space.xl }]}
        testID="start-board-screen"
      >
        <Wordmark />
        <Text style={styles.title}>{t('board.startTitle')}</Text>
        <Text style={styles.body}>{t('board.startBody')}</Text>

        <Text style={formStyles.label}>{t('board.boardName')}</Text>
        <Field
          value={boardName}
          onChangeText={setBoardName}
          autoCapitalize="words"
          returnKeyType="next"
          placeholder={t('board.boardNamePlaceholder')}
          accessibilityLabel={t('board.boardName')}
          testID="start-board-name"
        />

        <Text style={formStyles.label}>{t('board.yourName')}</Text>
        <Field
          style={styles.fieldTight}
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="next"
          placeholder={t('board.yourNamePlaceholder')}
          accessibilityLabel={t('board.yourName')}
          testID="start-your-name"
        />
        <Text style={styles.hint}>{t('board.yourNameHint')}</Text>

        {failed && (
          <Text style={formStyles.error} testID="start-error">
            {t('board.createFailed')}
          </Text>
        )}

        <View style={styles.keyNote}>
          <View style={styles.dot} />
          <Text style={styles.keyNoteText}>{t('board.keyWarning')}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [formStyles.primary, pressed && formStyles.primaryPressed]}
          disabled={isPending}
          onPress={() => {
            onCreate({ boardName, displayName })
          }}
          accessibilityRole="button"
          accessibilityLabel={t('board.create')}
          testID="start-create"
        >
          <Text style={formStyles.primaryText}>{t('board.create')}</Text>
        </Pressable>

        <View style={styles.footer}>
          {/* Shown only once there is somewhere for it to go: an invite arrives
            as a link, and there is no screen yet that takes one typed in. */}
          {onJoinInstead === undefined ? (
            <View />
          ) : (
            <View style={styles.footerLeft}>
              <Text style={styles.muted}>{t('board.haveInvite')}</Text>
              <Pressable
                onPress={onJoinInstead}
                accessibilityRole="button"
                accessibilityLabel={t('board.joinABoard')}
                testID="start-join-instead"
              >
                <Text style={styles.link}>{t('board.joinABoard')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoiding>
  )
}
