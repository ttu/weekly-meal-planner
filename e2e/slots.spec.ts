import { expect, test, type Page } from '@playwright/test'
import {
  addToBacklog,
  asNewVisitor,
  createBoard,
  openSharedPage,
  planFirstBacklogItem,
  resetDatabase,
  weekDates,
} from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * Slots are the rows of every day. A household that eats breakfast together
 * had no way to say so, and one that never plans lunch had no way to get the
 * row off the board.
 */
test.describe('a household changes its Slots', () => {
  let page: Page
  let days: string[]

  const firstDay = (): string => {
    const monday = days[0]
    if (monday === undefined) throw new Error('No week')
    return monday
  }

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Koivisto', yourName: 'Aino' })
    days = await weekDates(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('the board starts with lunch and dinner', async () => {
    const day = page.locator(`[data-testid="day-${firstDay()}"]`)
    await expect(day.getByText('Lunch', { exact: true })).toBeVisible()
    await expect(day.getByText('Dinner', { exact: true })).toBeVisible()
  })

  test('adding breakfast puts a row on every day', async () => {
    await page.getByTestId('open-settings').first().click()
    await expect(page.getByTestId('settings-screen')).toBeVisible()

    await page.getByTestId('settings-add-breakfast').click()
    await expect(page.getByTestId('settings-slot-breakfast')).toBeVisible()

    await page.goBack()
    const day = page.locator(`[data-testid="day-${firstDay()}"]`)
    await expect(day.getByText('Breakfast', { exact: true })).toBeVisible()
  })

  test('a Slot the household names itself keeps their own word', async () => {
    await page.getByTestId('open-settings').first().click()
    await page.getByTestId('settings-own-name').fill('Eväät')
    await page.getByTestId('settings-add-own').click()

    await expect(page.getByTestId('settings-slot-ev-t')).toBeVisible()
    await page.goBack()
    await expect(
      page.locator(`[data-testid="day-${firstDay()}"]`).getByText('Eväät', { exact: true }),
    ).toBeVisible()
  })

  // The order of the rows is the order the household eats in.
  test('a Slot can be moved later in the day', async () => {
    await page.getByTestId('open-settings').first().click()
    await page.getByTestId('settings-down-breakfast').click()

    await expect
      .poll(async () =>
        page
          .locator('[data-testid^="settings-slot-"]')
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? '')),
      )
      .toEqual([
        'settings-slot-lunch',
        'settings-slot-dinner',
        'settings-slot-ev-t',
        'settings-slot-breakfast',
      ])
    await page.goBack()
  })

  /**
   * The promise the screen makes: a Slot is configuration, and removing it
   * must not throw away a planned Meal.
   */
  test('removing a Slot keeps what was planned in it', async () => {
    await addToBacklog(page, 'Chili con carne')
    await planFirstBacklogItem(page, firstDay(), 'lunch')
    const day = page.locator(`[data-testid="day-${firstDay()}"]`)
    await expect(day.locator('[data-testid="meal-card-planned"]')).toHaveCount(1)

    await page.getByTestId('open-settings').first().click()
    await page.getByTestId('settings-remove-lunch').click()
    await expect(page.getByTestId('settings-slot-lunch')).toBeHidden()

    await page.goBack()
    await expect(day.getByText('Lunch', { exact: true })).toBeHidden()
    await expect(day.locator('[data-testid="meal-card-planned"]')).toHaveCount(0)

    await page.getByTestId('open-settings').first().click()
    await page.getByTestId('settings-add-lunch').click()
    await page.goBack()
    await expect(day.locator('[data-testid="meal-card-planned"]')).toHaveCount(1)
  })

  test('the last Slot cannot be removed', async () => {
    await page.getByTestId('open-settings').first().click()
    for (const key of ['breakfast', 'ev-t', 'dinner']) {
      await page.getByTestId(`settings-remove-${key}`).click()
      await expect(page.getByTestId(`settings-slot-${key}`)).toBeHidden()
    }

    await page.getByTestId('settings-remove-lunch').click()
    await expect(page.getByTestId('settings-error')).toBeVisible()
    await expect(page.getByTestId('settings-slot-lunch')).toBeVisible()
  })
})
