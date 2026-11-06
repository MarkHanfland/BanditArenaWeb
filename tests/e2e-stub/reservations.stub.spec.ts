import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { openMenuItem } from '../helpers/menuNav';
import { DATA, forwardCloud, playerCall, resetData, staffCall } from './support';

/**
 * Reservations on real cloud data (SW-175). The grid, the booking rules and the lists all come from
 * the cloud application; the console only draws them.
 */
test.beforeEach(async () => { await resetData(); });

async function openDay(page, date: string) {
  await forwardCloud(page);
  await signInAsVenueAdmin(page);
  await openMenuItem(page, 'operations', 'menu-reservations');
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible();
  await page.getByTestId('reservation-date').fill(date);
  await expect(page.getByTestId('reservation-grid')).toBeVisible();
}

// The venue opens at 09:00 Chicago time, so column 2 is 10:00 and column 4 is 11:00.
const cell = (device: string, column: number) => `slot-${device}-${column}`;

test('the grid shows the booked Player on the right machine and time', async ({ page }) => {
  await openDay(page, '2099-09-02');
  await expect(page.getByTestId('reservation-timezone')).toContainText('America/Chicago');
  await expect(page.getByTestId(cell(DATA.full, 2))).toContainText('Adult Player');
  await expect(page.getByTestId(cell(DATA.full, 3))).toContainText('Open');
  await expect(page.getByTestId(cell(DATA.basic, 2))).toContainText('Open');
});

test('booking an open time stores the reservation for that Player', async ({ page }) => {
  await openDay(page, '2099-09-03');
  await page.getByTestId(cell(DATA.basic, 4)).click();
  await page.getByTestId('reservation-book-open').click();
  await page.getByTestId('reservation-book-confirm').click();
  await expect(page.getByTestId('reservations-message')).toContainText('Reservation booked');
  await expect(page.getByTestId(cell(DATA.basic, 4))).toContainText('Adult Player');

  const stored = await playerCall(DATA.adultPlayer, '/reservations');
  const mine = stored.body.reservations.filter((r) => r.resourceId === DATA.basic && r.startTime.startsWith('2099-09-03'));
  expect(mine).toHaveLength(1);
  expect(mine[0].status).toBe('booked');
});

test('a Player who is already booked at that time is refused, and nothing is stored', async ({ page }) => {
  // The adult is booked on the full treadmill at 10:00 on the 2nd. Another treadmill at that time is refused.
  await openDay(page, '2099-09-02');
  await page.getByTestId(cell(DATA.basic, 2)).click();
  await page.getByTestId('reservation-book-open').click();
  await page.getByTestId('reservation-book-confirm').click();
  await expect(page.getByTestId('reservations-message')).toContainText('already has a reservation at this time');
  await expect(page.getByTestId(cell(DATA.basic, 2))).toContainText('Open');
  const stored = await playerCall(DATA.adultPlayer, '/reservations');
  expect(stored.body.reservations.filter((r) => r.resourceId === DATA.basic && r.startTime.startsWith('2099-09-02'))).toHaveLength(0);
});

test('only active Players can be booked from the grid', async ({ page }) => {
  await openDay(page, '2099-09-03');
  await page.getByTestId(cell(DATA.basic, 4)).click();
  await page.getByTestId('reservation-book-open').click();
  await page.getByRole('combobox', { name: 'Player' }).click();
  const options = page.getByRole('option');
  await expect(options.filter({ hasText: 'Adult Player' })).toHaveCount(1);
  await expect(options.filter({ hasText: 'Pending Player' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Suspended Player' })).toHaveCount(0);
  // The other tenant's Player is never listed.
  await expect(options.filter({ hasText: 'Tenant B Player' })).toHaveCount(0);
});

test('cancelling a booked time frees it for everyone', async ({ page }) => {
  await openDay(page, '2099-09-02');
  await page.getByTestId(cell(DATA.full, 2)).click();
  await expect(page.getByTestId('reservation-detail')).toContainText('Adult Player');
  await page.getByTestId('reservation-cancel').click();
  await expect(page.getByTestId('reservations-message')).toContainText('Reservation cancelled');
  await expect(page.getByTestId(cell(DATA.full, 2))).toContainText('Open');

  const slot = await staffCall('/reservations');
  const cancelled = slot.body.reservations.find((r) => r.slotId === DATA.bookedSlot);
  expect(cancelled?.status).not.toBe('booked');
});
