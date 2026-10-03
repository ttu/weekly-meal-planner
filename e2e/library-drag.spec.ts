import { expect, test, type Page } from '@playwright/test'
import {
  asNewVisitor,
  createBoard,
  dragOnto,
  openSharedPage,
  resetDatabase,
  weekDates,
} from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * The canvas's one gesture direction: library → backlog → board. Tapping a
 * library row has always added it to the Backlog; carrying it must do the
 * same, and carrying it further must plan it.
 */
test.describe('a Meal can be carried out of the library', () => {
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

  test('dropped on the Backlog, it becomes wanted this week', async () => {
    const pane = page.getByTestId('pane-library')
    await pane.getByTestId('library-search').fill('Chili con carne')
    const row = pane.locator('[data-testid^="library-meal-"]').first()
    await expect(row).toBeVisible()

    await dragOnto(page, row, page.getByTestId('backlog-shelf'))

    await expect(page.locator('[data-testid^="backlog-item-"]')).toHaveCount(1)
    await expect(page.getByTestId('backlog-shelf').getByText('Chili con carne')).toBeVisible()
  })

  test('dropped on a day, it is planned there outright', async () => {
    const thursday = days[3]
    if (thursday === undefined) throw new Error('no week')

    const pane = page.getByTestId('pane-library')
    await pane.getByTestId('library-search').fill('Salmon soup')
    const row = pane.locator('[data-testid^="library-meal-"]').first()
    await expect(row).toBeVisible()

    const slot = page.locator(`[data-testid="day-${thursday}"] [data-testid="slot-dinner"]`)
    await dragOnto(page, row, slot)

    await expect(slot.locator('[data-testid="meal-card-planned"]')).toBeVisible()
    // Straight onto the board: the Backlog is a staging post, not a toll gate.
    await expect(page.locator('[data-testid^="backlog-item-"]')).toHaveCount(1)
  })
})
