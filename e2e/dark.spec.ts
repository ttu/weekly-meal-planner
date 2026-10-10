import { expect, test, type Page } from '@playwright/test'
import { darkColours, lightColours } from '../src/shared/theme/palette'
import { asNewVisitor, createBoard, openSharedPage, resetDatabase, openSettings } from './fixtures'

test.describe.configure({ mode: 'serial' })

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
 * The board is warm paper by design, so light is what everyone gets until
 * they say otherwise — a phone left in dark mode must not change the app for
 * a household that never asked. Dark is a choice, made in Settings.
 */
test.describe('appearance', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    // A device that prefers dark, to prove it is not what decides.
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      colorScheme: 'dark',
    })
    page = await context.newPage()
    await asNewVisitor(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('a dark device still opens on light paper', async () => {
    expect(await groundOf(page, 'start-board-screen')).toBe(rgb(lightColours.surface))

    await createBoard(page, { boardName: 'Koivisto' })
    expect(await groundOf(page, 'board-header')).toBe(rgb(lightColours.surfaceRaised))
  })

  test('Settings turns the board dark', async () => {
    await openSettings(page)
    await expect(page.getByTestId('settings-screen')).toBeVisible()

    await page.getByTestId('settings-appearance-dark').click()
    await expect.poll(async () => groundOf(page, 'settings-screen')).toBe(rgb(darkColours.surface))

    await page.goBack()
    expect(await groundOf(page, 'board-header')).toBe(rgb(darkColours.surfaceRaised))
  })

  // Remembered on the device, not on the account: it is about this screen.
  test('the choice survives a reload', async () => {
    await page.reload()
    await expect(page.getByTestId('wide-board-layout')).toBeVisible()
    expect(await groundOf(page, 'board-header')).toBe(rgb(darkColours.surfaceRaised))
  })

  test('and can be handed back to the device', async () => {
    await openSettings(page)
    await page.getByTestId('settings-appearance-system').click()
    // The context prefers dark, so "match device" keeps it dark.
    await expect.poll(async () => groundOf(page, 'settings-screen')).toBe(rgb(darkColours.surface))

    await page.getByTestId('settings-appearance-light').click()
    await expect.poll(async () => groundOf(page, 'settings-screen')).toBe(rgb(lightColours.surface))
  })

  test('a second household starts light too', async () => {
    const fresh = await openSharedPage(page.context().browser()!)
    await asNewVisitor(fresh)
    expect(await groundOf(fresh, 'start-board-screen')).toBe(rgb(lightColours.surface))
    await fresh.close()
  })
})
