import { expect, test } from '@playwright/test'
import { boardScreen, rawKeysIn, startBoard } from './fixtures'

test('every screen is translated, in English and in Finnish', async ({ page }) => {
  await page.goto('/start')
  await expect(page.getByTestId('start-board-screen')).toBeVisible()
  expect(rawKeysIn(await page.locator('body').innerText())).toEqual([])

  await startBoard(page)
  const screens = [
    ['/', 'wide-board-layout'],
    ['/meals', 'meal-library-screen'],
    ['/meals/new', 'meal-editor-screen'],
    ['/shopping', 'shopping-screen'],
    ['/settings', 'settings-screen'],
  ] as const
  const checkAll = async () => {
    for (const [path, screen] of screens) {
      await page.goto(path)
      await expect(page.getByTestId(screen)).toBeVisible()
      expect(rawKeysIn(await page.locator('body').innerText()), path).toEqual([])
    }
  }
  await checkAll()

  // checkAll ends on Settings.
  await page.getByTestId('settings-language-fi').click()
  await expect(page.getByTestId('settings-screen').getByText('Asetukset').first()).toBeVisible()
  await checkAll()

  // The choice is kept on this device.
  await page.goto('/')
  await expect(boardScreen(page)).toBeVisible()
  await expect(page.getByTestId('nav-shopping').first()).toContainText('Ostokset')
})
