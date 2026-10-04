import { expect, test, type Page } from '@playwright/test'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase } from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * Locale is a Household setting, not a device one (ADR 0009): everyone on the
 * board reads the same Catalogue and gets the same Shopping List. English is
 * what a board speaks until someone says otherwise.
 */
test.describe('the language of a board', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    // A browser that asks for Finnish, to prove it is not what decides.
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      locale: 'fi-FI',
    })
    page = await context.newPage()
    await asNewVisitor(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('a new board is in English, whatever the browser asks for', async () => {
    await expect(page.getByText('Start a board')).toBeVisible()

    await createBoard(page, { boardName: 'Koivisto' })
    await expect(page.getByText("This week's backlog")).toBeVisible()
  })

  test('Settings switches the whole board to Finnish', async () => {
    await page.getByTestId('open-settings').first().click()
    await expect(page.getByTestId('settings-screen')).toBeVisible()

    await page.getByTestId('settings-language-fi').click()
    await expect(page.getByTestId('settings-screen').getByText('Asetukset')).toBeVisible()

    await page.goBack()
    await expect(page.getByText('Tämän viikon jono')).toBeVisible()
  })

  // The Catalogue has one row per locale; the library must not show both, and
  // must show the one the household reads.
  test('the Catalogue follows it', async () => {
    const pane = page.getByTestId('pane-library')
    await pane.getByTestId('library-search').fill('jauheliha')
    await expect(pane.locator('[data-testid^="library-meal-"]')).not.toHaveCount(0)
    await pane.getByTestId('library-search').fill('')
  })

  test('the choice is the board’s, so it survives a reload', async () => {
    await page.reload()
    await expect(page.getByText('Tämän viikon jono')).toBeVisible()
  })

  test('and can be put back', async () => {
    await page.getByTestId('open-settings').first().click()
    await page.getByTestId('settings-language-en').click()
    await expect(page.getByTestId('settings-screen').getByText('Settings')).toBeVisible()
  })

  test('a different board still starts in English', async () => {
    const fresh = await openSharedPage(page.context().browser()!)
    await asNewVisitor(fresh)
    await expect(fresh.getByText('Start a board')).toBeVisible()
    await fresh.close()
  })
})
