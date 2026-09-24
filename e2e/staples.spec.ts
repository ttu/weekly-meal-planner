import { expect, test, type Page } from '@playwright/test'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase, weekDates } from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * Spices, oil and flour are bought in quantities that last months. A list that
 * asks for them every week is a list nobody reads to the end — so a Household
 * can say what it always has in, and say when it has run out.
 */
test.describe('the cupboard', () => {
  let page: Page
  let onionId: string

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Koivisto' })
    const days = await weekDates(page)
    const monday = days[0]
    if (monday === undefined) throw new Error('no week')

    const pane = page.getByTestId('pane-library')
    await pane.getByTestId('library-search').fill('Chili con carne')
    await pane.locator('[data-testid^="library-meal-"]').first().click()
    await page.waitForTimeout(900)

    await page.locator('[data-testid^="backlog-item-"]').first().click()
    await expect(page.getByTestId('plan-sheet')).toBeVisible()
    await page.getByTestId(`plan-day-${monday}`).click()
    await page.getByTestId('plan-slot-dinner').click()
    await page.getByTestId('plan-submit').click()
    await expect(page.getByTestId('plan-sheet')).toBeHidden()

    await page.goto('/shopping')
    await expect(page.getByTestId('shopping-screen')).toBeVisible()
    const onion = page.locator('[data-testid^="buy-"]').filter({ hasText: /^onion/ })
    await expect(onion).toHaveCount(1)
    onionId = ((await onion.getAttribute('data-testid')) ?? '').replace('buy-', '')
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('an Ingredient the household always has in leaves the Buy list', async () => {
    await page.getByTestId(`why-${onionId}`).click()
    await page.getByTestId(`keep-${onionId}`).click()

    await expect(page.getByTestId(`buy-${onionId}`)).toHaveCount(0)
    await expect(page.getByTestId(`out-of-${onionId}`)).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: '/tmp/vv8/01-cupboard.png' })
  })

  test('saying it has run out puts it back on the list', async () => {
    await page.getByTestId(`out-of-${onionId}`).click()

    await expect(page.getByTestId(`buy-${onionId}`)).toBeVisible()
    await expect(page.getByTestId(`promoted-${onionId}`)).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: '/tmp/vv8/02-promoted.png' })
  })

  test('a household can stop keeping something in', async () => {
    await page.getByTestId(`why-${onionId}`).click()
    await page.getByTestId(`keep-${onionId}`).click()
    await expect(page.getByTestId(`out-of-${onionId}`)).toBeVisible()

    await page.getByTestId(`stop-keeping-${onionId}`).click()

    await expect(page.getByTestId(`buy-${onionId}`)).toBeVisible()
    await expect(page.getByTestId(`promoted-${onionId}`)).toHaveCount(0)
  })
})
