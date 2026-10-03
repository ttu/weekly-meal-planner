import { expect, test, type Page } from '@playwright/test'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase } from './fixtures'

test.describe.configure({ mode: 'serial' })

const PHOTO = 'e2e/files/meal-photo.png'

/**
 * A photo is the fastest way to recognise a Meal on a crowded board, and the
 * column for it existed long before anything could fill it.
 */
test.describe('a Meal carries a photo', () => {
  let page: Page

  const pickPhoto = async (): Promise<void> => {
    const chooser = page.waitForEvent('filechooser')
    await page.getByTestId('editor-pick-photo').click()
    await (await chooser).setFiles(PHOTO)
  }

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Koivisto' })
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('a new Meal takes a picture from the device', async () => {
    await page.goto('/meals/new')
    await expect(page.getByTestId('editor-photo-empty')).toBeVisible()

    await pickPhoto()
    await expect(page.getByTestId('editor-photo')).toBeVisible()

    await page.getByTestId('editor-name').fill('Mummon lihapullat')
    await page.getByTestId('editor-save').click()
    await expect(page.getByTestId('meal-library-screen')).toBeVisible()
  })

  // The bucket is private, so the card can only show it through a signed URL —
  // the half of this that is easy to get wrong.
  test('the photo comes back on the card, signed', async () => {
    const chip = page.locator('[data-testid^="library-meal-"]').first().locator('img').first()
    await expect(chip).toBeVisible()
    const src = await chip.getAttribute('src')
    expect(src).toContain('/storage/v1/object/sign/meal-photo/')
  })

  test('the photo survives reopening the Meal', async () => {
    await page.locator('[data-testid^="library-meal-"]').first().click()
    await expect(page.getByTestId('editor-photo')).toBeVisible()
  })

  test('a photo can be taken off again', async () => {
    await page.getByTestId('editor-remove-photo').click()
    await expect(page.getByTestId('editor-photo-empty')).toBeVisible()

    await page.getByTestId('editor-save').click()
    await expect(page.getByTestId('meal-library-screen')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('meal-library-screen')).toBeVisible()
    await expect(page.locator('[data-testid^="library-meal-"]').first().locator('img')).toHaveCount(
      0,
    )
  })
})
