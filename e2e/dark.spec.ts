import { expect, test, type Page } from '@playwright/test'
import { darkColours, lightColours } from '../src/shared/theme/palette'
import { asNewVisitor, createBoard, resetDatabase } from './fixtures'

/** react-native-web renders colours as rgb(); compare on that footing. */
const rgb = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`
}

const groundOf = async (page: Page, testId: string): Promise<string> =>
  page
    .getByTestId(testId)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor)

/**
 * The board is opened at 6am and at 10pm. Both palettes live under the same
 * semantic names, so this checks the plumbing rather than the values: that the
 * device's scheme reaches the paper, and that a screen built from the shared
 * form styles follows it too.
 */
test.describe('the board follows the device between light and dark', () => {
  test('a dark device gets the dark paper', async ({ browser }) => {
    resetDatabase()
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()

    await asNewVisitor(page)
    expect(await groundOf(page, 'start-board-screen')).toBe(rgb(darkColours.surface))

    await createBoard(page, { boardName: 'Koivisto' })
    await expect(page.getByTestId('day-one')).toBeVisible()
    expect(await groundOf(page, 'board-header')).toBe(rgb(darkColours.surfaceRaised))

    await context.close()
  })

  test('a light device gets the canvas, unchanged', async ({ browser }) => {
    resetDatabase()
    const context = await browser.newContext({ colorScheme: 'light' })
    const page = await context.newPage()

    await asNewVisitor(page)
    expect(await groundOf(page, 'start-board-screen')).toBe(rgb(lightColours.surface))

    await createBoard(page, { boardName: 'Koivisto' })
    expect(await groundOf(page, 'board-header')).toBe(rgb(lightColours.surfaceRaised))

    await context.close()
  })
})
