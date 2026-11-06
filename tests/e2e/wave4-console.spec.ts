import { expect, test } from '@playwright/test'
import { signInAs, signInAsCloudAdmin, signInAsFleetAdmin, signInAsVenueAdmin } from '../helpers/auth'
import { mockCloudApi } from '../helpers/mockApis'
import { openMenuItem } from '../helpers/menuNav'

test('cloud admin edits a license plan', async ({ page }) => {
  await mockCloudApi(page)
  await signInAsCloudAdmin(page)
  await openMenuItem(page, 'business', 'menu-billing')
  await page.getByTestId('commerce-tab-licensing').click()
  await page.getByTestId('edit-plan-venue_pro').click()
  await page.getByTestId('plan-name').fill('Venue Pro Plus')
  await page.getByTestId('plan-save').click()
  await expect(page.getByTestId('billing-message')).toContainText('Updated plan venue_pro')
})

test('venue admin saves weekly hours and a holiday', async ({ page }) => {
  await mockCloudApi(page)
  await signInAsVenueAdmin(page)
  await openMenuItem(page, 'operations', 'menu-venue-hours')
  await expect(page.getByRole('heading', { name: 'Venue hours' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Opens' }).first().click()
  await page.getByRole('option', { name: '10:00 AM' }).click()
  await page.getByRole('combobox', { name: 'Closes' }).first().click()
  await page.getByRole('option', { name: '6:00 PM' }).click()
  await page.getByTestId('hours-closed-sunday').check()
  await page.getByTestId('hours-holiday').fill('2026-12-25')
  await page.getByTestId('hours-add-holiday').click()
  await expect(page.getByTestId('holiday-2026-12-25')).toBeVisible()
  await page.getByTestId('hours-save').click()
  await expect(page.getByTestId('venue-hours-message')).toContainText('Saved hours for venue-demo-001')
})

test('venue admin home stays quiet when the local machine is offline', async ({ page }) => {
  await page.route('http://localhost:9724/**', (route) => route.abort())
  await mockCloudApi(page)
  await signInAs(page, 'venueAdmin', { cloudConsole: true })
  await expect(page.getByTestId('header-local-offline')).toBeVisible()
  await expect(page.getByTestId('page-error')).toHaveCount(0)
  await expect(page.getByText('Authentication required')).toHaveCount(0)
})

test('venue admin books a grid slot and opens session history for the venue', async ({ page }) => {
  await mockCloudApi(page)
  await signInAsVenueAdmin(page)
  await openMenuItem(page, 'operations', 'menu-reservations')
  await expect(page.getByTestId('venue-banner')).toContainText('Bandit Arena Lab')
  await expect(page.getByTestId('reservation-grid')).toBeVisible()
  await expect(page.locator('[data-testid^="reservation-period-"]').first()).toBeVisible()
  await page.getByTestId('slot-instance-1-0').click()
  await expect(page.getByTestId('reservation-detail')).toBeVisible()
  await expect(page.getByTestId('reservation-start')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByTestId('slot-instance-2-1').click()
  await page.getByTestId('reservation-book-open').click()
  await page.getByTestId('reservation-book-confirm').click()
  await expect(page.getByTestId('reservations-message')).toContainText('Reservation booked')
  await openMenuItem(page, 'operations', 'menu-sessions')
  await expect(page.getByText('Requires fleet-admin')).toHaveCount(0)
  await expect(page.getByTestId('venue-banner')).toContainText('Bandit Arena Lab')
})

test('fleet admin sees a stopped rollout', async ({ page }) => {
  await mockCloudApi(page)
  await signInAsFleetAdmin(page)
  await openMenuItem(page, 'device-fleet', 'menu-fleet')
  await expect(page.getByTestId('release-health')).toContainText('Rollout stopped for 1.3.0')
})
