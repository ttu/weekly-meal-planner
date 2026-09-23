import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { formStyles } from '@/shared/theme/form-styles'
import { useTranslation } from '@/shared/i18n'
import type { JoinBoardError } from '../application/boards'

const errorKey = (error: JoinBoardError): string => {
  if (error === 'rate-limited') return 'board.joinRateLimited'
  // A wrong link and a wrong password say the same thing, because the server
  // does not distinguish them either (ADR 0010).
  return 'board.joinRejected'
}

type Props = {
  readonly isPending: boolean
  readonly error?: JoinBoardError | undefined
  readonly onJoin: (input: { password: string; displayName: string }) => void
}

export const JoinBoardScreen = ({ isPending, error, onJoin }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  return (
    <ScrollView
      style={formStyles.screen}
      contentContainerStyle={{ paddingTop: insets.top + tokens.space.xl }}
      testID="join-board-screen"
    >
      <Text style={formStyles.title}>{t('board.joinTitle')}</Text>
      <Text style={[formStyles.muted, { marginBottom: tokens.space.lg }]}>
        {t('board.joinBody')}
      </Text>

      <Text style={formStyles.label}>{t('board.yourName')}</Text>
      <TextInput
        style={formStyles.field}
        value={displayName}
        onChangeText={setDisplayName}
        accessibilityLabel={t('board.yourName')}
        testID="join-your-name"
      />

      <Text style={formStyles.label}>{t('board.password')}</Text>
      <TextInput
        style={formStyles.field}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        accessibilityLabel={t('board.password')}
        testID="join-password"
      />

      {error !== undefined && (
        <Text style={formStyles.error} testID="join-error">
          {t(errorKey(error))}
        </Text>
      )}

      <Pressable
        style={formStyles.primary}
        disabled={isPending}
        onPress={() => {
          onJoin({ password, displayName })
        }}
        accessibilityRole="button"
        accessibilityLabel={t('board.join')}
        testID="join-submit"
      >
        <Text style={formStyles.primaryText}>{t('board.join')}</Text>
      </Pressable>
    </ScrollView>
  )
}
