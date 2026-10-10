import { useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from '@/shared/i18n'
import { goBackTo } from '@/shared/navigation/go-back-to'
import { ShoppingListScreen, buildAgentPrompt, useShoppingList } from '@/features/shopping'

export default function Shopping(): React.JSX.Element {
  const { t } = useTranslation()
  const { list, toggle, outOf, addItem, toggleExtra, keepInCupboard, stopKeeping } =
    useShoppingList()
  const [justCopied, setJustCopied] = useState(false)

  return (
    <ShoppingListScreen
      list={list}
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
  )
}
