import { expect, test, type Page } from '@playwright/test'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase, weekDates } from './fixtures'

test.describe.configure({ mode: 'serial' })

/**
 * A screen reader hears what is ticked, chosen and open from the ARIA
 * attributes alone. react-native-web drops `accessibilityState` without a
 * word, so every one of these read as unticked and unchosen until they were
 * written as `aria-*` props.
 */
test.describe('a screen reader hears the state of a control', () => {
  let page: Page
  let monday: string

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Koivisto' })
    const days = await weekDates(page)
    const first = days[0]
    if (first === undefined) throw new Error('no week')
    monday = first
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('the tab it is on', async () => {
    await expect(page.getByTestId('nav-week')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('nav-meals')).toHaveAttribute('aria-selected', 'false')
  })

  test('the day and Slot picked in the plan sheet', async () => {
    const pane = page.getByTestId('pane-library')
    await pane.getByTestId('library-search').fill('Chili con carne')
    await pane.locator('[data-testid^="library-meal-"]').first().click()
    await page.locator('[data-testid^="backlog-item-"]').first().click()
    await expect(page.getByTestId('plan-sheet')).toBeVisible()

    await page.getByTestId(`plan-day-${monday}`).click()
    await page.getByTestId('plan-slot-dinner').click()

    await expect(page.getByTestId(`plan-day-${monday}`)).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('plan-slot-dinner')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('plan-slot-lunch')).toHaveAttribute('aria-checked', 'false')

    // Each choice is a labelled radiogroup with one Tab stop: the chosen day.
    await expect(page.getByRole('radiogroup', { name: 'Day' })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Slot' })).toBeVisible()
    const dayGroup = page.getByRole('radiogroup', { name: 'Day' })
    await expect(dayGroup.locator('[role="radio"][tabindex="0"]')).toHaveCount(1)

    // Arrow keys move the choice, Space picks the focused option.
    const tuesday = page.locator('[data-testid^="plan-day-"]').nth(1)
    await page.getByTestId(`plan-day-${monday}`).focus()
    await page.keyboard.press('ArrowRight')
    await expect(tuesday).toHaveAttribute('aria-checked', 'true')
    await expect(tuesday).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId(`plan-day-${monday}`)).toHaveAttribute('aria-checked', 'true')

    await page.getByTestId('plan-slot-lunch').focus()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('plan-slot-lunch')).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('plan-slot-dinner')).toHaveAttribute('aria-checked', 'true')

    await page.getByTestId('plan-submit').click()
    await expect(page.getByTestId('plan-sheet')).toBeHidden()
  })

  test('a Buy Line that has been ticked', async () => {
    await page.goto('/shopping')
    const line = page.locator('[data-testid^="buy-"]').first()
    await expect(line).toHaveAttribute('aria-checked', 'false')
    await line.click()
    await expect(page.locator('[role="checkbox"][aria-checked="true"]')).toHaveCount(1)
  })

  test('the language and appearance chosen in Settings', async () => {
    await page.goto('/settings')
    await expect(page.getByTestId('settings-language-en')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('settings-language-fi')).toHaveAttribute('aria-checked', 'false')
    await expect(
      page.locator('[data-testid^="settings-appearance-"][aria-checked="true"]'),
    ).toHaveCount(1)
  })
})
