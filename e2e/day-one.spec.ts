import { expect, test, type Page } from '@playwright/test'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase } from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * The first minute on a brand-new board. An empty week is the normal starting
 * point, not a failure, and it used to say "Nobody has added anything yet."
 * with nothing to press.
 */
test.describe('day one', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Koivisto' })
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('a new board offers somewhere to start', async () => {
    await expect(page.getByTestId('day-one')).toBeVisible()
    await expect(page.getByTestId('day-one-browse')).toBeVisible()
    await expect(page.getByTestId('day-one-write-own')).toBeVisible()
    await expect(page.getByTestId('day-one-invite')).toBeVisible()
  })

  test('the second offer opens the Meal editor', async () => {
    await page.getByTestId('day-one-write-own').click()
    await expect(page.getByTestId('meal-editor-screen')).toBeVisible()
    await page.getByTestId('editor-cancel').click()
  })

  test('the first offer opens the picker, and the panel goes once a Meal is wanted', async () => {
    await expect(page.getByTestId('day-one')).toBeVisible()
    await page.getByTestId('day-one-browse').click()
    await expect(page.getByTestId('meal-picker')).toBeVisible()

    await page.getByTestId('picker-search').fill('Tacos')
    await page.locator('[data-testid^="picker-meal-"]').first().click()

    await expect(page.getByTestId('day-one')).toBeHidden()
  })
})
