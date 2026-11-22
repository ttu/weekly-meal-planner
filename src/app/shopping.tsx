import { useState } from 'react'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { useLocale, useTranslation } from '@/shared/i18n'
import { loadState } from '@/shared/query/load-state'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { AppNav } from '@/shared/ui/AppNav'
import { useRefresh } from '@/features/sync'
import {
  ShoppingListScreen,
  buildAgentPrompt,
  stillToBuy,
  useShoppingList,
} from '@/features/shopping'

export default function Shopping(): React.JSX.Element {
  const { t } = useTranslation()
  const locale = useLocale()
  const shopping = useShoppingList()
  const { list, toggle, outOf, addItem, toggleExtra, keepInCupboard, stopKeeping } = shopping
  const [justCopied, setJustCopied] = useState(false)
  const { refreshing, refresh } = useRefresh()

  return (
    <>
      <ShoppingListScreen
        list={list}
        loadState={loadState(shopping)}
        writeFailed={shopping.failed}
        refreshing={refreshing}
        onRefresh={refresh}
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
            buildAgentPrompt(
              list,
              t('shopping.promptIntro'),
              (unit) => t(`unit.${unit}`, { defaultValue: unit }),
              locale,
            ),
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
        shoppingCount={stillToBuy(list)}
        onGo={(destination) => {
          if (destination === 'week') goBackTo('/')
          if (destination === 'meals') router.replace('/meals')
        }}
      />
    </>
  )
}
