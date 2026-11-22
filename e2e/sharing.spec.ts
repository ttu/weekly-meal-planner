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

/** Longer than the 15 s poll, so a change made elsewhere has time to arrive. */
const SYNC = { timeout: 40_000 }

test('two Members share a board through the relay until one is removed', async ({ browser }) => {
  const aino = await newDevice(browser)
  const sanni = await newDevice(browser)

  await startBoard(aino.page, 'Koivisto', 'Aino')
  const link = await inviteLink(aino.page)

  await joinWith(sanni.page, link, 'Sanni')
  await expect(sanni.page.getByText('Koivisto').first()).toBeVisible()

  // Sanni's wish reaches Aino's open board with no reload.
  await addToBacklog(sanni.page, 'Tacos')
  await expect(aino.page.getByTestId('pane-backlog').getByText('Tacos')).toBeVisible(SYNC)

  // And Aino's reaches Sanni.
  await addToBacklog(aino.page, 'Carbonara')
  await expect(sanni.page.getByTestId('pane-backlog').getByText('Carbonara')).toBeVisible(SYNC)

  await openSettings(aino.page)
  const members = aino.page.getByTestId('settings-members')
  await expect(members.getByText('Sanni', { exact: true })).toBeVisible()
  await members.locator('[data-testid^="member-remove-"]').click()
  await aino.page.getByTestId('confirm-yes').click()
  await expect(members.getByText('Sanni', { exact: true })).toBeHidden()

  // Sanni's device learns it on its next sync: the board is gone from it.
  await sanni.page.reload()
  await expect(sanni.page.getByTestId('no-household-screen')).toBeVisible(SYNC)
  await expect(boardScreen(sanni.page)).toBeHidden()

  await aino.context.close()
  await sanni.context.close()
})
