import { expect, test } from '@playwright/test'
import {
  addToBacklog,
  boardScreen,
  inviteLink,
  joinWith,
  newDevice,
  openSettings,
  startBoard,
} from './fixtures'

/** Two busy ticks of the sync loop, well under its quiet 2 minutes. */
const BUSY = { timeout: 35_000 }

test('two Members share a board through the relay until one is removed', async ({ browser }) => {
  const aino = await newDevice(browser)
  const sanni = await newDevice(browser)

  await startBoard(aino.page, 'Koivisto', 'Aino')
  const link = await inviteLink(aino.page)

  await joinWith(sanni.page, link, 'Sanni')
  await expect(sanni.page.getByText('Koivisto').first()).toBeVisible()

  // Both are busy on the board now, so each open board syncs every 15 s
  // rather than every 2 minutes: changes cross with no reload.
  await addToBacklog(aino.page, 'Carbonara')
  await expect(sanni.page.getByTestId('pane-backlog').getByText('Carbonara')).toBeVisible(BUSY)
  await addToBacklog(sanni.page, 'Tacos')
  await expect(aino.page.getByTestId('pane-backlog').getByText('Tacos')).toBeVisible(BUSY)

  await openSettings(aino.page)
  const members = aino.page.getByTestId('settings-members')
  await expect(members.getByText('Sanni', { exact: true })).toBeVisible()
  await members.locator('[data-testid^="member-remove-"]').click()
  await aino.page.getByTestId('confirm-yes').click()
  await expect(members.getByText('Sanni', { exact: true })).toBeHidden()

  // Sanni's device learns it on its next sync (a reload syncs at once).
  await sanni.page.reload()
  await expect(sanni.page.getByTestId('no-household-screen')).toBeVisible()
  await expect(boardScreen(sanni.page)).toBeHidden()

  await aino.context.close()
  await sanni.context.close()
})
