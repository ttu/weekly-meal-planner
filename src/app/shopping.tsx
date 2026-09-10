import { useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from '@/shared/i18n'
import { ShoppingListScreen, buildAgentPrompt, useShoppingList } from '@/features/shopping'

export default function Shopping(): React.JSX.Element {
  const { t } = useTranslation()
  const { list, toggle, outOf, addItem, toggleExtra } = useShoppingList()
  const [justCopied, setJustCopied] = useState(false)

  return (
    <ShoppingListScreen
      list={list}
      onToggle={toggle}
      onOutOf={outOf}
      onAddExtra={addItem}
      onToggleExtra={toggleExtra}
      justCopied={justCopied}
      onCopyPrompt={() => {
        void Clipboard.setStringAsync(buildAgentPrompt(list, t('shopping.promptIntro'))).then(
          () => {
            setJustCopied(true)
            setTimeout(() => {
              setJustCopied(false)
            }, 2000)
          },
        )
      }}
    />
  )
}
