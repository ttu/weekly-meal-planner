import type { ShoppingList } from './types'

const formatAmounts = (line: ShoppingList['buy'][number]): string =>
  line.amounts.map((a) => `${String(a.quantity)} ${a.unit}`).join(' + ')

/**
 * Text for pasting into a browser AI agent. It carries no Member names, no
 * Household id and no URL — items and quantities only (docs/06-security.md).
 * The clipboard is the least private place in the system.
 *
 * A ticked line is already in the basket, so it is left out — of Buy Lines and
 * Extras alike. Ordering what someone has just carried home is the one mistake
 * this text can make that costs money.
 */
export const buildAgentPrompt = (list: ShoppingList, intro: string): string => {
  const items = list.buy
    .filter((line) => !line.checked)
    .map((line) => `- ${formatAmounts(line)} ${line.name}`)
  const extras = list.extras.filter((e) => !e.checked).map((e) => `- ${e.label}`)

  return [intro, ...items, ...extras].join('\n')
}
