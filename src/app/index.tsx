import { useState } from 'react'
import { Redirect, router } from 'expo-router'
import { Share, StyleSheet, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { themed, useThemed } from '@/shared/theme/theme'
import { NoHouseholdScreen, useSession } from '@/features/household'
import { BoardScreen } from '@/features/planning'
import { useShoppingList } from '@/features/shopping'

const sheets = themed((tokens) =>
  StyleSheet.create({ loading: { flex: 1, backgroundColor: tokens.color.surface } }),
)

export default function Index(): React.JSX.Element {
  const styles = useThemed(sheets)
  const { client, userId, household, householdChecked } = useSession()
  const [shared, setShared] = useState(false)
  // The badge on the Shopping destination: what is still to buy for the week
  // on screen. Derived, like the list itself (ADR 0003).
  const { list } = useShoppingList()

  // No identity at all: start a board. Signing in with an email is offered
  // there, rather than being the first thing anyone is asked for (ADR 0010).
  if (userId === undefined) return <Redirect href="/start" />

  if (!householdChecked) {
    return <View style={styles.loading} testID="board-loading" />
  }

  if (household === undefined) return <NoHouseholdScreen client={client} />

  return (
    <BoardScreen
      origin={process.env.EXPO_OS === 'web' ? window.location.origin : 'https://menami.app'}
      shared={shared}
      onShare={(url) => {
        // Copy on web, the OS share sheet on a device: on a phone the link is
        // going straight into a family chat.
        if (process.env.EXPO_OS === 'web') {
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
      shoppingCount={list.buy.filter((line) => !line.checked).length}
      onWriteOwnMeal={(name) => {
        router.push(
          name === undefined ? '/meals/new' : { pathname: '/meals/new', params: { name } },
        )
      }}
    />
  )
}
