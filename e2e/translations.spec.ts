import { expect, test } from '@playwright/test'
import { asNewVisitor, createBoard } from './fixtures'

/**
 * A raw key on screen — "board.thisWeek" instead of "This week" — is invisible
 * to unit tests and obvious to a person. It happened once, when a namespace was
 * replaced instead of merged.
 */
const expectNoRawKeys = (text: string): void => {
  const rawKeys = [...text.matchAll(/\b[a-z][a-zA-Z]*\.[a-z][a-zA-Z]+\b/g)]
    .map((m) => m[0])
    // Real content contains dots too: file names, decimals, domains.
    .filter((candidate) => !/\.(com|fi|test|app|png|jpg)$/.test(candidate))
  expect(rawKeys).toEqual([])
}

test.describe('no screen shows a raw translation key', () => {
  test('the whole signed-in app', async ({ page }) => {
    await asNewVisitor(page)
    expectNoRawKeys(await page.locator('body').innerText())

    await createBoard(page, { boardName: 'Kielitesti' })

    for (const path of ['/', '/meals', '/shopping', '/meals/new', '/settings', '/join']) {
      await page.goto(path)
      await page.waitForTimeout(1500)
      expectNoRawKeys(await page.locator('body').innerText())
    }
  })

  test('the join screen', async ({ page }) => {
    await page.goto('/join/some-token-that-does-not-exist')
    await expect(page.getByTestId('join-board-screen')).toBeVisible()
    expectNoRawKeys(await page.locator('body').innerText())
  })
})
