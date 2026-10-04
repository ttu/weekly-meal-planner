import { useState } from 'react'
import { Redirect, router } from 'expo-router'
import { Platform, Share, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useTheme } from '@/shared/theme/theme'
import { NoHouseholdScreen, useSession } from '@/features/household'
import { BoardScreen } from '@/features/planning'

export default function Index(): React.JSX.Element {
  const theme = useTheme()
  const { client, userId, household, householdChecked } = useSession()
  const [shared, setShared] = useState(false)

  // No identity at all: start a board. Signing in with an email is offered
  // there, rather than being the first thing anyone is asked for (ADR 0010).
  if (userId === undefined) return <Redirect href="/start" />

  if (!householdChecked) {
    return <View style={{ flex: 1, backgroundColor: theme.color.surface }} testID="board-loading" />
  }

  if (household === undefined) return <NoHouseholdScreen client={client} />

  return (
    <BoardScreen
      origin={Platform.OS === 'web' ? window.location.origin : 'https://mealplanner.app'}
      shared={shared}
      onShare={(url) => {
        // Copy on web, the OS share sheet on a device: on a phone the link is
        // going straight into a family chat.
        if (Platform.OS === 'web') {
          void Clipboard.setStringAsync(url).then(() => {
            setShared(true)
            setTimeout(() => {
              setShared(false)
            }, 2000)
          })
          return
        }
        void Share.share({ message: url })
      }}
      onOpenLibrary={() => {
        router.push('/meals')
      }}
      onOpenShopping={() => {
        router.push('/shopping')
      }}
      onOpenSettings={() => {
        router.push('/settings')
      }}
      onWriteOwnMeal={() => {
        router.push('/meals/new')
      }}
    />
  )
}
