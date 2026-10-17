import { expect, test } from '@playwright/test'
import { signInAsCloudAdmin, signInAsFleetAdmin } from '../helpers/auth'
import { mockCloudApi } from '../helpers/mockApis'
import { openMenuItem } from '../helpers/menuNav'

test('a cloud admin can exclude a venue from public booking', async ({ page }) => {
  await mockCloudApi(page)
  await signInAsCloudAdmin(page)
  await openMenuItem(page, 'business', 'menu-accounts')
  await page.getByTestId('accounts-tab-venues').click()
  await page.getByTestId('accounts-edit-venue-demo-001').click()
  const checkbox = page.getByTestId('accounts-public-booking')
  await expect(checkbox).toBeChecked()
  const saved = page.waitForRequest((request) => (
    request.method() === 'PATCH' && request.url().includes('/venues/venue-demo-001')
  ))
  await checkbox.uncheck()
  await page.getByTestId('accounts-save').click()
  const request = await saved
  expect(request.postDataJSON().published).toBe(false)
  await page.getByTestId('accounts-edit-venue-demo-001').click()
  await expect(page.getByTestId('accounts-public-booking')).not.toBeChecked()
})

test('fleet can exclude a venue and one treadmill from public booking', async ({ page }) => {
  await mockCloudApi(page)
  await page.route('**/api/venues/venue-chi-rivernorth', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    const body = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ venue: { venueId: 'venue-chi-rivernorth', published: body.published } }),
    })
  })
  await page.route('**/api/devices/ba-chi-01/public-booking', async (route) => {
    const body = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ device: { instanceId: 'ba-chi-01', publicBooking: body.publicBooking } }),
    })
  })
  await signInAsFleetAdmin(page)
  await openMenuItem(page, 'device-fleet', 'menu-fleet')
  await expect(page.getByTestId('fleet-venue-public-booking')).toHaveText('Public booking')
  await page.getByTestId('fleet-venue-public-booking').click()
  await expect(page.getByTestId('fleet-venue-public-booking')).toHaveText('Venue excluded from public booking')
  await expect(page.getByTestId('fleet-public-booking-ba-chi-01')).toHaveText('Public booking')
  await page.getByTestId('fleet-public-booking-ba-chi-01').click()
  await expect(page.getByTestId('fleet-public-booking-ba-chi-01')).toHaveText('Excluded from public booking')
})
