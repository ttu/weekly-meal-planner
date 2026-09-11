import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import type { CreateBoardError } from '../application/boards'

const errorKey = (error: CreateBoardError): string =>
  error === 'short-password' ? 'board.shortPassword' : 'board.createFailed'

type Props = {
  readonly isPending: boolean
  readonly error?: CreateBoardError | undefined
  readonly onCreate: (input: { boardName: string; displayName: string; password: string }) => void
  readonly onSignInInstead: () => void
}

/**
 * The first screen for someone with no account. It asks for three things and
 * nothing else — a board name, their own name, and the password the family will
 * use to join (ADR 0010).
 */
export const StartBoardScreen = ({
  isPending,
  error,
  onCreate,
  onSignInInstead,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [boardName, setBoardName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')

  return (
    <ScrollView
      style={formStyles.screen}
      contentContainerStyle={{ paddingTop: insets.top + tokens.space.xl }}
      testID="start-board-screen"
    >
      <Text style={formStyles.title}>{t('board.startTitle')}</Text>
      <Text style={[formStyles.muted, { marginBottom: tokens.space.lg }]}>
        {t('board.startBody')}
      </Text>

      <Text style={formStyles.label}>{t('board.boardName')}</Text>
      <TextInput
        style={formStyles.field}
        value={boardName}
        onChangeText={setBoardName}
        accessibilityLabel={t('board.boardName')}
        testID="start-board-name"
      />

      <Text style={formStyles.label}>{t('board.yourName')}</Text>
      <TextInput
        style={formStyles.field}
        value={displayName}
        onChangeText={setDisplayName}
        accessibilityLabel={t('board.yourName')}
        testID="start-your-name"
      />

      <Text style={formStyles.label}>{t('board.password')}</Text>
      <TextInput
        style={formStyles.field}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        accessibilityLabel={t('board.password')}
        testID="start-password"
      />
      <Text style={[formStyles.muted, { marginBottom: tokens.space.md }]}>
        {t('board.passwordHint')}
      </Text>

      {error !== undefined && (
        <Text style={formStyles.error} testID="start-error">
          {t(errorKey(error))}
        </Text>
      )}

      <Pressable
        style={formStyles.primary}
        disabled={isPending}
        onPress={() => {
          onCreate({ boardName, displayName, password })
        }}
        accessibilityRole="button"
        accessibilityLabel={t('board.create')}
        testID="start-create"
      >
        <Text style={formStyles.primaryText}>{t('board.create')}</Text>
      </Pressable>

      {/* Said before it can bite, not after. */}
      <Text style={[formStyles.muted, { marginVertical: tokens.space.md }]}>
        {t('board.anonymousWarning')}
      </Text>

      <Pressable
        onPress={onSignInInstead}
        accessibilityRole="button"
        accessibilityLabel={t('board.signInInstead')}
        testID="start-sign-in-instead"
      >
        <Text style={formStyles.quietAction}>{t('board.signInInstead')}</Text>
      </Pressable>
    </ScrollView>
  )
}
