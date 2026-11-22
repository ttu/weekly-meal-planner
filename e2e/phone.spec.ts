import { expect, test } from '@playwright/test'
import { catalogueId, newDevice, startBoard, weekDates } from './fixtures'

test('on a phone, a Meal goes from the picker to the Backlog to a Slot', async ({ browser }) => {
  const { context, page } = await newDevice(browser, { width: 390, height: 844 })
  await startBoard(page)
  await expect(page.getByTestId('board-screen')).toBeVisible()

  await page.getByTestId('backlog-add').click()
  await expect(page.getByTestId('meal-picker')).toBeVisible()
  await page.getByTestId('picker-search').fill('Salmon soup')
  await page.getByTestId(`picker-meal-${catalogueId('Salmon soup')}`).click()
  await expect(page.getByTestId('meal-picker')).toBeHidden()

  const [, tuesday] = await weekDates(page)
  await page.locator('[data-testid^="backlog-item-"]').first().click()
  await page.getByTestId(`plan-day-${tuesday ?? ''}`).click()
  await page.getByTestId('plan-slot-dinner').click()
  await page.getByTestId('plan-submit').click()
  await expect(page.getByTestId('plan-sheet')).toBeHidden()
  await expect(page.locator('[data-testid^="planned-"]').getByText('Salmon soup')).toBeVisible()

  await context.close()
})
