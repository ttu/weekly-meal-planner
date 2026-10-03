import { expect, test } from '@playwright/test'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase } from './fixtures'

/**
 * A link on its own gets nobody in. The panel has to say so, and it must not
 * pretend to know the password — only its hash is stored (ADR 0010).
 */
test('sharing shows the link and names what it is missing', async ({ browser }) => {
  test.setTimeout(300_000)
  resetDatabase()
  const page = await openSharedPage(browser)
  await asNewVisitor(page)
  await createBoard(page, { boardName: 'Koivisto' })

  await page.getByTestId('share-board').click()
  await expect(page.getByTestId('share-sheet')).toBeVisible()

  const link = await page.getByTestId('share-link').textContent()
  expect(link).toContain('/join/')

  await expect(page.getByText('tell them the password separately')).toBeVisible()
  await expect(page.getByText("it isn't stored, only checked")).toBeVisible()

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByTestId('share-copy').click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)

  await page.getByTestId('share-close').click()
  await expect(page.getByTestId('share-sheet')).toBeHidden()
  await page.close()
})
