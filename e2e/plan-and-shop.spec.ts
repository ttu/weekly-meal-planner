import { expect, test } from '@playwright/test'
import { addToBacklog, boardScreen, planFirstBacklogItem, startBoard, weekDates } from './fixtures'

test('a planned Meal lands on its day and its Ingredients on the Shopping List', async ({
  page,
}) => {
  await startBoard(page)
  await addToBacklog(page, 'Carbonara')
  await expect(page.locator('[data-testid^="backlog-item-"]')).toHaveCount(1)

  const [, , wednesday] = await weekDates(page)
  await planFirstBacklogItem(page, wednesday ?? '', 'dinner')
  const day = page.getByTestId(`day-${wednesday ?? ''}`)
  await expect(day.getByText('Carbonara')).toBeVisible()
  await expect(page.locator('[data-testid^="backlog-item-"]')).toHaveCount(0)

  await page.getByTestId('nav-shopping').first().click()
  await expect(page.getByTestId('shopping-screen')).toBeVisible()
  await expect(page.getByTestId('buy-pasta')).toBeVisible()
  await expect(page.getByTestId('buy-bacon')).toBeVisible()

  // The board is on this device: a reload keeps it.
  await page.goto('/')
  await expect(boardScreen(page)).toBeVisible()
  await expect(page.getByTestId(`day-${wednesday ?? ''}`).getByText('Carbonara')).toBeVisible()
})

test('a Household Meal written here can be planned and shopped for', async ({ page }) => {
  await startBoard(page)
  await page.getByTestId('library-add').click()
  await expect(page.getByTestId('meal-editor-screen')).toBeVisible()
  await page.getByTestId('editor-name').fill('Mummon lihakeitto')
  await page.getByTestId('editor-add-ingredient').click()
  await page.getByTestId('ingredient-search').fill('potato')
  await page.getByTestId('ingredient-option-potato').click()
  await page.getByTestId('ingredient-quantity-potato').fill('800')
  await page.getByTestId('editor-save').click()

  await expect(page.getByTestId('meal-editor-screen')).toBeHidden()
  await page.goto('/')
  const pane = page.getByTestId('pane-library')
  await pane.getByTestId('library-search').fill('Mummon')
  await pane.locator('[data-testid^="library-meal-"]').first().click()

  const [monday] = await weekDates(page)
  await planFirstBacklogItem(page, monday ?? '', 'lunch')
  await expect(page.getByTestId(`day-${monday ?? ''}`).getByText('Mummon lihakeitto')).toBeVisible()

  await page.getByTestId('nav-shopping').first().click()
  await expect(page.getByTestId('buy-potato')).toBeVisible()
})
