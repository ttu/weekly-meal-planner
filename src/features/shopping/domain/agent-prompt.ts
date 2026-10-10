import type { ShoppingList } from './types'

const formatAmounts = (
  line: ShoppingList['buy'][number],
  unitLabel: (unit: string) => string,
): string => line.amounts.map((a) => `${String(a.quantity)} ${unitLabel(a.unit)}`).join(' + ')

/**
 * Text for pasting into a browser AI agent. It carries no Member names, no
 * Household id and no URL — items and quantities only (docs/06-security.md).
 * The clipboard is the least private place in the system.
 *
 * A ticked line is already in the basket, so it is left out — of Buy Lines and
 * Extras alike. Ordering what someone has just carried home is the one mistake
 * this text can make that costs money.
 *
 * `unitLabel` is passed in rather than read here, the same way the screen gets
 * it: units are stored as stable keys and translated at the edge, never kept
 * as display text (ADR 0009). Without it the prompt mixed the two, asking a
 * Finnish shop for "3 tin kidneypapuja".
 */
export const buildAgentPrompt = (
  list: ShoppingList,
  intro: string,
  unitLabel: (unit: string) => string,
): string => {
  const items = list.buy
    .filter((line) => !line.checked)
    .map((line) => `- ${formatAmounts(line, unitLabel)} ${line.name}`)
  const extras = list.extras.filter((e) => !e.checked).map((e) => `- ${e.label}`)

  return [intro, ...items, ...extras].join('\n')
}
