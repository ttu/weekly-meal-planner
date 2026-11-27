import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

/**
 * A board lives in browser storage and Playwright gives each context fresh
 * storage, so a context is a device. Several devices in one test are several
 * contexts.
 */
export const newDevice = async (
  browser: Browser,
  viewport = { width: 1400, height: 900 },
): Promise<{ context: BrowserContext; page: Page }> => {
  const context = await browser.newContext({ viewport })
  return { context, page: await context.newPage() }
}

export const startBoard = async (page: Page, boardName = 'Koivisto', yourName = 'Aino') => {
  await page.goto('/start')
  await page.getByTestId('start-board-name').fill(boardName)
  await page.getByTestId('start-your-name').fill(yourName)
  await page.getByTestId('start-create').click()
  await expect(boardScreen(page)).toBeVisible()
}

/** The board at either width: three panes when wide, one column on a phone. */
export const boardScreen = (page: Page) =>
  page.getByTestId('wide-board-layout').or(page.getByTestId('board-screen'))

/** A Catalogue Meal's id is `catalogue-` and the slug of its English name. */
export const catalogueId = (englishName: string): string =>
  `catalogue-${englishName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

/** The seven ISO dates of the week on screen, Monday first. */
export const weekDates = async (page: Page): Promise<string[]> => {
  await expect(page.locator('[data-testid^="day-2"]').first()).toBeVisible()
  const ids = await page
    .locator('[data-testid^="day-2"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? ''))
  return ids.map((id) => id.replace('day-', ''))
}

/** Wide board: a tap on a Meal in the library pane puts it on the Backlog. */
export const addToBacklog = async (page: Page, englishName: string) => {
  const pane = page.getByTestId('pane-library')
  await pane.getByTestId('library-search').fill(englishName)
  await pane.getByTestId(`library-meal-${catalogueId(englishName)}`).click()
  await pane.getByTestId('library-search').fill('')
}

/** Plans the first Backlog card through the plan sheet. */
export const planFirstBacklogItem = async (page: Page, date: string, slot: string) => {
  await page.locator('[data-testid^="backlog-item-"]').first().click()
  await expect(page.getByTestId('plan-sheet')).toBeVisible()
  await page.getByTestId(`plan-day-${date}`).click()
  await page.getByTestId(`plan-slot-${slot}`).click()
  await page.getByTestId('plan-submit').click()
  await expect(page.getByTestId('plan-sheet')).toBeHidden()
}

/** An invite link, made from the board's share sheet. */
export const inviteLink = async (page: Page): Promise<string> => {
  await page.getByTestId('share-board').click()
  await page.getByTestId('share-create').click()
  const link = page.getByTestId('share-link')
  await expect(link).toContainText('/join#')
  const url = await link.innerText()
  await page.getByTestId('share-close').click()
  return url
}

export const joinWith = async (page: Page, link: string, yourName: string) => {
  await page.goto(link)
  await page.getByTestId('join-your-name').fill(yourName)
  await page.getByTestId('join-submit').click()
  await expect(boardScreen(page)).toBeVisible()
}

export const openSettings = async (page: Page) => {
  await page.getByTestId('open-board-menu').first().click()
  await page.getByTestId('menu-settings').click()
  await expect(page.getByTestId('settings-screen')).toBeVisible()
}

/**
 * A raw key on screen ("board.thisWeek" instead of "This week") is invisible to
 * unit tests and obvious to a person.
 */
export const rawKeysIn = (text: string): string[] =>
  [...text.matchAll(/\b[a-z][a-zA-Z]*\.[a-z][a-zA-Z]+\b/g)]
    .map((m) => m[0])
    .filter((candidate) => !/\.(com|fi|test|app|png|jpg)$/.test(candidate))
