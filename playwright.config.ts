import { defineConfig, devices } from '@playwright/test'

const PORT = 8099
const BASE_URL = `http://127.0.0.1:${String(PORT)}`

/**
 * Drives the real app in a browser against a local relay. Nothing is mocked:
 * these tests exist to catch what unit tests cannot — a screen that renders a
 * raw translation key, a drag that lands on the wrong Slot, a save that
 * succeeds but never navigates.
 *
 * The suite from before ADR 0013 needed Supabase and was removed; it has to be
 * rebuilt against `pnpm dlx wrangler dev --config relay/wrangler.toml` (TODO.md).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI === undefined ? [['list']] : [['github'], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1400, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec expo start --web --port ${String(PORT)}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
