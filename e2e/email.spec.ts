import { expect, test, type Page } from '@playwright/test'
import {
  asNewVisitor,
  confirmationLink,
  createBoard,
  emptyInbox,
  openSharedPage,
  resetDatabase,
} from './fixtures'

test.describe.configure({ mode: 'serial' })

const EMAIL = 'aino@example.test'

/**
 * "This phone holds your key to the board. Clearing app data loses it — add
 * an email later to keep it safe." The start screen has said that since the
 * first version; this is the later.
 */
test.describe('adding an email to an anonymous board', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    resetDatabase()
    await emptyInbox()
    page = await openSharedPage(browser)
    await asNewVisitor(page)
    await createBoard(page, { boardName: 'Koivisto', yourName: 'Aino' })
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('an obvious typo is refused before anything is sent', async () => {
    await page.getByTestId('open-settings').first().click()
    await expect(page.getByTestId('settings-screen')).toBeVisible()

    await page.getByTestId('settings-email-field').fill('aino')
    await page.getByTestId('settings-send-link').click()

    await expect(page.getByTestId('settings-email-error')).toBeVisible()
  })

  test('a real address gets a link, and nothing changes until it is clicked', async () => {
    await page.getByTestId('settings-email-field').fill(EMAIL)
    await page.getByTestId('settings-send-link').click()

    await expect(page.getByTestId('settings-email-pending')).toBeVisible()
    // Still anonymous: the address is pending, not on the account.
    await expect(page.getByTestId('settings-email')).toBeHidden()
  })

  test('clicking the link puts the address on the account', async () => {
    await page.goto(await confirmationLink())

    await expect(page.getByTestId('settings-screen')).toBeVisible()
    await expect(page.getByTestId('settings-email')).toContainText(EMAIL)
    await expect(page.getByTestId('settings-email-field')).toBeHidden()
  })

  // The whole point: the seat survives the device.
  test('the board is still theirs after the confirmation', async () => {
    await page.goto('/')
    await expect(page.getByTestId('wide-board-layout')).toBeVisible()
    await expect(page.getByText('Koivisto')).toBeVisible()
  })
})
