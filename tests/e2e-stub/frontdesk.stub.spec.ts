import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/auth';
import { DATA, STUB, forwardCloud, playerCall, resetData, staffCall } from './support';

/**
 * The Front Desk journey on real cloud data (FR-SW-UI-018, SW-160): the agent signs in, lands on
 * Reservations, sees each Player's status on the day's grid, checks a Player in from the pass, and
 * adds a walk-in. Each action is checked from what the cloud stored.
 */
test.beforeEach(async () => { await resetData(); });

async function openAsFrontDesk(page) {
  await forwardCloud(page);
  await signInAs(page, 'frontDesk');
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible(); // the landing page
}
async function openDay(page, date: string) {
  await openAsFrontDesk(page);
  await page.getByTestId('reservation-date').fill(date);
  await expect(page.getByTestId('reservation-grid')).toBeVisible();
}
const cell = (device: string, column: number) => `slot-${device}-${column}`;
const status = (device: string, column: number) => `slot-status-${device}-${column}`;

test('FR-SW-UI-018: a Front Desk Agent lands on Reservations and sees no device controls', async ({ page }) => {
  await openAsFrontDesk(page);
  await expect(page.getByTestId('menu-reservations')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('safety-control')).toHaveCount(0);
  await expect(page.getByTestId('device-status-band')).toHaveCount(0);
  await expect(page.getByTestId('check-in-panel')).toBeVisible();
  await expect(page.getByTestId('walk-in-open')).toBeVisible();
});

test('FR-SW-UI-018: each Player on the grid shows booked, checked in, or no-show', async ({ page }) => {
  await openDay(page, '2099-09-02');
  await expect(page.getByTestId(status(DATA.full, 2))).toHaveText('Booked');
  await page.getByTestId('reservation-date').fill('2099-09-03');
  await expect(page.getByTestId(status(DATA.full, 2))).toHaveText('Checked in');
  await page.getByTestId('reservation-date').fill('2099-09-04');
  await expect(page.getByTestId(status(DATA.full, 2))).toContainText('No-show: Adult Player');
  await expect(page.getByTestId(cell(DATA.full, 2))).toContainText('Open'); // the machine is free again
});

test('FR-SW-UI-018: scanning a Player\'s pass checks them in and says what is still missing', async ({ page }) => {
  const pass = await playerCall(DATA.adultPlayer, `/players/me/session-pass?reservationId=${DATA.bookedSlot}`);
  expect(pass.status, JSON.stringify(pass.body)).toBe(200);

  await openDay(page, '2099-09-02');
  await expect(page.getByTestId(status(DATA.full, 2))).toHaveText('Booked');
  await page.getByTestId('check-in-code').fill(pass.body.payload);
  await page.getByTestId('check-in-submit').click();
  const result = page.getByTestId('check-in-result');
  await expect(result).toContainText('Adult Player is checked in');
  // The dataset's adult has not signed the current waiver, and the desk is told so.
  await expect(result).toContainText('The current waiver must be signed');
  await expect(page.getByTestId(status(DATA.full, 2))).toHaveText('Checked in');

  const stored = (await staffCall('/reservations')).body.reservations.find((r) => r.slotId === DATA.bookedSlot);
  expect(stored.status).toBe('checked_in');

  // The same pass works once.
  await page.getByTestId('check-in-code').fill(pass.body.payload);
  await page.getByTestId('check-in-submit').click();
  await expect(page.getByTestId('check-in-result')).toContainText('already used');
});

test('FR-SW-UI-018: a code the cloud does not know is refused with a reason and changes nothing', async ({ page }) => {
  await openDay(page, '2099-09-02');
  await page.getByTestId('check-in-code').fill('not-a-real-pass');
  await page.getByTestId('check-in-submit').click();
  await expect(page.getByTestId('check-in-result')).toContainText('not recognized');
  await expect(page.getByTestId(status(DATA.full, 2))).toHaveText('Booked');
});

test('FR-SW-UI-018: a walk-in is booked on the next open half hour today', async ({ page }) => {
  // Today's grid is the venue's own day. Late in the evening there is no half hour left to book.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const day = await fetch(`${STUB}/api/venues/${DATA.chicago}/availability?date=${today}`);
  const grid: any = await day.json();
  const comingUp = (grid.slots || []).some((slot) => Date.parse(slot.startTime) > Date.now() + 5 * 60 * 1000 && slot.state === 'free');
  test.skip(!comingUp, 'no open half hour is left today in the venue\'s time');

  await openAsFrontDesk(page);
  await page.getByTestId('walk-in-open').click();
  await page.getByTestId('walk-in-confirm').click();
  await expect(page.getByTestId('reservations-message')).toContainText('Walk-in booked on');

  const mine = (await playerCall(DATA.adultPlayer, '/reservations')).body.reservations
    .filter((r) => r.source !== 'player_portal' && Date.parse(r.startTime) > Date.now() - 60 * 1000 && r.startTime.startsWith(today.slice(0, 4)) && r.slotId !== DATA.bookedSlot);
  expect(mine.length, 'the walk-in is stored for the Player').toBeGreaterThan(0);
  expect(mine[0].status).toBe('booked');
});
