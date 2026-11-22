import { expect, test } from '@playwright/test'
import { boardScreen } from './fixtures'

test('a board can be started from the keyboard alone', async ({ page }) => {
  await page.goto('/start')
  await page.getByTestId('start-board-name').fill('Koivisto')
  await page.getByTestId('start-board-name').press('Enter')
  // Enter moved focus on to the name field: type into whatever has focus.
  await expect(page.getByTestId('start-your-name')).toBeFocused()
  await page.keyboard.type('Aino')
  await page.keyboard.press('Enter')
  await expect(boardScreen(page)).toBeVisible()
})
