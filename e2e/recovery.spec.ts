import { expect, test } from '@playwright/test'
import {
  addToBacklog,
  boardScreen,
  joinWith,
  newDevice,
  openSettings,
  startBoard,
} from './fixtures'

test('a recovery link brings the board back on a new device as the same Member', async ({
  browser,
}) => {
  const old = await newDevice(browser)
  await old.context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await startBoard(old.page, 'Koivisto', 'Aino')
  await addToBacklog(old.page, 'Carbonara')

  await openSettings(old.page)
  await old.page.getByTestId('settings-recovery').click()
  const link = await old.page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('/join#')
  await old.context.close()

  const fresh = await newDevice(browser)
  await joinWith(fresh.page, link, 'Aino')
  await expect(boardScreen(fresh.page)).toBeVisible()
  await expect(fresh.page.getByTestId('pane-backlog').getByText('Carbonara')).toBeVisible()

  await openSettings(fresh.page)
  // The seat came back, not a new one: still one Member, still Aino, still the admin.
  const rows = fresh.page.getByTestId('settings-members').locator('[data-testid^="member-"]')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Aino · You')
  await expect(rows).toContainText('Admin')
  await fresh.context.close()
})
