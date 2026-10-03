import { expect, test, type Page } from '@playwright/test'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase, weekDates } from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * Chili twice in one week is ordinary, and so is chili twice on one Tuesday.
 * Nothing anywhere may quietly collapse two of the same Meal into one — not
 * the Backlog, not the board, not a unique constraint added by accident.
 */
test.describe('the same Meal, more than once', () => {
  let page: Page
  let days: string[]

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Koivisto' })
    days = await weekDates(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('the Backlog takes it as many times as it is asked', async () => {
    const pane = page.getByTestId('pane-library')
    await pane.getByTestId('library-search').fill('Chili con carne')

    for (let i = 1; i <= 3; i += 1) {
      await pane.locator('[data-testid^="library-meal-"]').first().click()
      await expect(page.locator('[data-testid^="backlog-item-"]')).toHaveCount(i)
    }
  })

  test('two of them can land on one Slot, and it says so first', async () => {
    const monday = days[0]
    if (monday === undefined) throw new Error('no week')
    const slot = page.locator(`[data-testid="day-${monday}"] [data-testid="meal-card-planned"]`)

    for (let i = 1; i <= 2; i += 1) {
      await page.locator('[data-testid^="backlog-item-"]').first().click()
      await expect(page.getByTestId('plan-sheet')).toBeVisible()
      await page.getByTestId(`plan-day-${monday}`).click()
      await page.getByTestId('plan-slot-dinner').click()
      // The app never refuses the edit; it says what will happen instead.
      if (i === 2) await expect(page.getByTestId('plan-will-join')).toBeVisible()
      await page.getByTestId('plan-submit').click()
      await expect(page.getByTestId('plan-sheet')).toBeHidden()
      await expect(slot).toHaveCount(i)
    }
  })

  test('and on two different days at once', async () => {
    const tuesday = days[1]
    if (tuesday === undefined) throw new Error('no week')

    await page.locator('[data-testid^="backlog-item-"]').first().click()
    await expect(page.getByTestId('plan-sheet')).toBeVisible()
    await page.getByTestId(`plan-day-${tuesday}`).click()
    await page.getByTestId('plan-slot-dinner').click()
    await page.getByTestId('plan-submit').click()
    await expect(page.getByTestId('plan-sheet')).toBeHidden()

    await expect(page.locator('[data-testid="meal-card-planned"]')).toHaveCount(3)
  })
})
