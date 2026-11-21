import { useState } from 'react'
import { Redirect, router } from 'expo-router'
import { Share, StyleSheet, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { themed, useThemed } from '@/shared/theme/theme'
import { NoHouseholdScreen, createInviteLink, useBoardSession } from '@/features/household'
import { useSync } from '@/features/sync'
import { BoardScreen } from '@/features/planning'
import { useShoppingList } from '@/features/shopping'

const sheets = themed((tokens) =>
  StyleSheet.create({ loading: { flex: 1, backgroundColor: tokens.color.surface } }),
)

export default function Index(): React.JSX.Element {
  const styles = useThemed(sheets)
  const { household, checked: householdChecked } = useBoardSession()
  const { engine, leave } = useSync()
  const [shared, setShared] = useState(false)
  // The badge on the Shopping destination: what is still to buy for the week
  // on screen. Derived, like the list itself (ADR 0003).
  const { list } = useShoppingList()

  // No board on this device: start one, or join with an invite (ADR 0013).
  const loading = <View style={styles.loading} testID="board-loading" />
  if (engine === undefined) return householdChecked ? <Redirect href="/start" /> : loading
  if (!householdChecked) return loading

  if (household === undefined) {
    return (
      <NoHouseholdScreen
        onStart={() => {
          router.push('/start')
        }}
        onJoin={() => {
          router.push('/join')
        }}
      />
    )
  }

  return (
    <BoardScreen
      createInvite={() =>
        createInviteLink(
          engine,
          process.env.EXPO_OS === 'web' ? window.location.origin : 'https://menami.app',
        )
      }
      onLeave={() => {
        void leave()
      }}
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
