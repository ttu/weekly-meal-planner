import { execFileSync } from 'node:child_process'
import { expect, type Browser, type Locator, type Page } from '@playwright/test'

export const DEMO_PASSWORD = 'kaalikaari'

const DB_CONTAINER = 'supabase_db_weekly-meal-planner'

/**
 * A clean board, between specs.
 *
 * DELETE, not TRUNCATE. `truncate household cascade` empties every table with a
 * foreign key to it — including all of `meal`, Catalogue rows and all — and the
 * library came up empty. Deleting rows follows `on delete cascade` one row at a
 * time, so Household Meals go and the Catalogue stays.
 *
 * Deleting the Households takes their Members, Week Plans, Backlog Items, Cook
 * Events and Meals with them; deleting the users takes the anonymous accounts.
 * The Catalogue and the Ingredient taxonomy are untouched, so nothing needs
 * re-syncing.
 *
 * Run inside the container rather than over the host's psql: the client there
 * is whatever Homebrew last installed, and it does not have to match the
 * server.
 */
export const resetDatabase = (): void => {
  execFileSync(
    'docker',
    [
      'exec',
      DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'delete from household; delete from auth.users;',
    ],
    { stdio: 'ignore' },
  )
}

/** The token in a board's share link, read straight from the database rather
 *  than off the clipboard — the clipboard needs browser permissions and tells
 *  us nothing extra. */
export const shareTokenFor = (boardName: string): string =>
  execFileSync(
    'docker',
    [
      'exec',
      DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atc',
      `select share_token from household where name = '${boardName}'`,
    ],
    { encoding: 'utf8' },
  ).trim()

/**
 * One page shared across a spec's tests.
 *
 * Playwright gives each test a fresh context, which means fresh browser
 * storage — and an anonymous board lives entirely in that storage. A test that
 * expects the board the previous test created would land on the start screen
 * instead, so a spec that tells one story shares one page.
 */
export const openSharedPage = async (browser: Browser): Promise<Page> => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  return context.newPage()
}

/** A visitor with no identity at all — the state a first-time person is in. */
export const asNewVisitor = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.goto('/start')
  await expect(page.getByTestId('start-board-screen')).toBeVisible()
}

export const createBoard = async (
  page: Page,
  { boardName = 'Koivisto', yourName = 'Aino', password = DEMO_PASSWORD } = {},
): Promise<void> => {
  await page.getByTestId('start-board-name').fill(boardName)
  await page.getByTestId('start-your-name').fill(yourName)
  await page.getByTestId('start-password').fill(password)
  await page.getByTestId('start-create').click()
  await expect(
    page.getByTestId('board-screen').or(page.getByTestId('wide-board-layout')),
  ).toBeVisible()
}

/** The seven ISO dates of the week the app is currently showing. */
export const weekDates = async (page: Page): Promise<string[]> => {
  const ids = await page
    .locator('[data-testid^="day-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? ''))
  return ids.map((id) => id.replace('day-', '')).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
}

/**
 * Adds a Meal to the Backlog by visible name.
 *
 * Two routes, because the design gives the two widths two: a wide board drags
 * or taps from the Meal library pane, a phone opens the picker from the shelf.
 */
export const addToBacklog = async (page: Page, mealName: string): Promise<void> => {
  const libraryPane = page.getByTestId('pane-library')

  if (await libraryPane.isVisible()) {
    await libraryPane.getByTestId('library-search').fill(mealName)
    await libraryPane.locator('[data-testid^="library-meal-"]').first().click()
    await libraryPane.getByTestId('library-search').fill('')
    return
  }

  await page.getByTestId('backlog-add').click()
  await expect(page.getByTestId('meal-picker')).toBeVisible()
  await page.getByTestId('picker-search').fill(mealName)
  await page.locator('[data-testid^="picker-meal-"]').first().click()
  await expect(page.getByTestId('meal-picker')).toBeHidden()
}

/** Plans the first Backlog card onto a day and Slot through the plan sheet. */
export const planFirstBacklogItem = async (
  page: Page,
  date: string,
  slot: 'lunch' | 'dinner',
): Promise<void> => {
  await page.locator('[data-testid^="backlog-item-"]').first().click()
  await expect(page.getByTestId('plan-sheet')).toBeVisible()
  await page.getByTestId(`plan-day-${date}`).click()
  await page.getByTestId(`plan-slot-${slot}`).click()
  await page.getByTestId('plan-submit').click()
  await expect(page.getByTestId('plan-sheet')).toBeHidden()
}

/**
 * Drags an element onto another with real mouse moves.
 *
 * Playwright's dragTo sends too few moves for a pan gesture recogniser to
 * activate: react-native-gesture-handler needs to see the pointer travel.
 */
export const dragOnto = async (page: Page, from: Locator, to: Locator): Promise<void> => {
  const source = await from.boundingBox()
  const target = await to.boundingBox()
  if (source === null || target === null) throw new Error('Cannot drag: element has no box')

  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 }
  const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * step) / 20,
      start.y + ((end.y - start.y) * step) / 20,
    )
  }
  await page.mouse.up()
}
