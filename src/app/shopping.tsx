import { useState } from 'react'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from '@/shared/i18n'
import { loadState } from '@/shared/query/load-state'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { AppNav } from '@/shared/ui/AppNav'
import { ShoppingListScreen, buildAgentPrompt, useShoppingList } from '@/features/shopping'

export default function Shopping(): React.JSX.Element {
  const { t } = useTranslation()
  const shopping = useShoppingList()
  const { list, toggle, outOf, addItem, toggleExtra, keepInCupboard, stopKeeping } = shopping
  const [justCopied, setJustCopied] = useState(false)

  return (
    <>
      <ShoppingListScreen
        list={list}
        loadState={loadState(shopping)}
        onRetry={shopping.refetch}
        onToggle={toggle}
        onOutOf={outOf}
        onKeepInCupboard={keepInCupboard}
        onStopKeeping={stopKeeping}
        onAddExtra={addItem}
        onToggleExtra={toggleExtra}
        justCopied={justCopied}
        onBack={() => {
          goBackTo('/')
        }}
        onCopyPrompt={() => {
          void Clipboard.setStringAsync(
            buildAgentPrompt(list, t('shopping.promptIntro'), (unit) => t(`unit.${unit}`)),
          ).then(() => {
            setJustCopied(true)
            setTimeout(() => {
              setJustCopied(false)
            }, 2000)
          })
        }}
      />
      <AppNav
        active="shopping"
        shoppingCount={list.buy.filter((line) => !line.checked).length}
        onGo={(destination) => {
          if (destination === 'week') goBackTo('/')
          if (destination === 'meals') router.replace('/meals')
        }}
      />
    </>
  )
}
