import { expect, test } from '@playwright/test'

const TEST_VENUE = 'Level 5 Venue A1'
const PUBLIC_VENUES = ['Chicago Lab', 'Nashville Lab']

test('test venue admin works only the dedicated test venue', async ({ page }) => {
  const password = process.env.BANDIT_E2E_PASSWORD
  test.skip(!password, 'Set BANDIT_E2E_PASSWORD to run against the live console')
  const username = process.env.BANDIT_E2E_USERNAME || 'test-venue-admin'

  await page.goto('/')
  await page.locator('input[name="username"]').fill(username)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByTestId('venue-banner')).toContainText(TEST_VENUE, { timeout: 30_000 })
  for (const name of PUBLIC_VENUES) {
    await expect(page.getByText(name)).toHaveCount(0)
  }

  await page.getByTestId('menu-reservations').click()
  await expect(page.getByTestId('reservation-grid')).toBeVisible()
  await expect(page.locator('[data-testid^="reservation-period-"]').first()).toBeVisible()
  await expect(page.getByTestId('venue-banner')).toContainText(TEST_VENUE)
})
