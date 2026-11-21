import type { Locale } from '@/shared/i18n'
import type { Amount, ShoppingList } from './types'

/** Unticked Buy Lines and unticked Extras: the "N still to buy" and the badge. */
export const stillToBuy = (list: ShoppingList): number =>
  list.buy.filter((line) => !line.checked).length +
  list.extras.filter((extra) => !extra.checked).length

/** Only a list with nothing in any section may say "nothing to buy". */
export const isEmptyList = (list: ShoppingList): boolean =>
  list.buy.length === 0 &&
  list.cupboard.length === 0 &&
  list.extras.length === 0 &&
  list.incomplete.length === 0

/**
 * "1,5 kg + 2 tbsp" — numbers written the way the Household's Locale writes
 * them. Shared by the screen and the Agent Prompt, which must not drift apart.
 */
export const formatAmounts = (
  amounts: readonly Amount[],
  unitLabel: (unit: string) => string,
  locale: Locale,
): string =>
  amounts.map((a) => `${a.quantity.toLocaleString(locale)} ${unitLabel(a.unit)}`).join(' + ')
