import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { openMenuItem } from '../helpers/menuNav';
import { DATA, forwardCloud, playerCall, resetData } from './support';

/**
 * Venue hours on real cloud data (SW-122, SW-058). The hours a Venue Administrator saves decide
 * which times a Player is offered, so each change is checked from the Player's side too.
 *
 * Chicago starts as: Monday 10:00-20:00, Sunday closed, 25 December closed, other days 09:00-21:00.
 * 2099-09-07 is a Monday, 2099-09-09 a Wednesday, 2099-09-12 a Saturday.
 */
test.beforeEach(async () => { await resetData(); });

async function openHours(page) {
  await forwardCloud(page);
  await signInAsVenueAdmin(page);
  await openMenuItem(page, 'operations', 'menu-venue-hours');
  await expect(page.getByRole('heading', { name: 'Venue hours' })).toBeVisible();
  await expect(page.getByTestId('venue-hours')).toBeVisible();
}

/** The start times a Player is offered on one date, as local clock text in Chicago. */
async function timesOn(date: string) {
  const res = await playerCall(DATA.adultPlayer, `/venues/${DATA.chicago}/availability?date=${date}`);
  expect(res.status).toBe(200);
  return (res.body.slots as Array<{ startTime: string }>).map((slot) => new Date(slot.startTime).toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit',
  }));
}

test('the page shows the hours the cloud holds for this venue', async ({ page }) => {
  await openHours(page);
  await expect(page.getByTestId('hours-closed-sunday')).toBeChecked();
  await expect(page.getByTestId('hours-closed-monday')).not.toBeChecked();
  await expect(page.getByTestId('hours-open-monday')).toHaveValue('10:00');
  await expect(page.getByTestId('hours-close-monday')).toHaveValue('20:00');
  await expect(page.getByTestId('holiday-2099-12-25')).toBeVisible();
});

test('saved hours, a closed day and a new holiday change what a Player is offered', async ({ page }) => {
  const before = await timesOn('2099-09-07');
  expect(before[0]).toBe('10:00 AM');
  expect(before.at(-1)).toBe('7:30 PM');
  expect((await timesOn('2099-09-12')).length).toBeGreaterThan(0);
  expect((await timesOn('2099-09-09')).length).toBeGreaterThan(0);

  await openHours(page);
  await page.getByRole('combobox', { name: 'Opens' }).first().click(); // Monday
  await page.getByRole('option', { name: '12:00 PM' }).click();
  await page.getByRole('combobox', { name: 'Closes' }).first().click();
  await page.getByRole('option', { name: '6:00 PM' }).click();
  await page.getByTestId('hours-closed-saturday').check();
  await page.getByTestId('hours-holiday').fill('2099-09-09');
  await page.getByTestId('hours-add-holiday').click();
  await expect(page.getByTestId('holiday-2099-09-09')).toBeVisible();
  await page.getByTestId('hours-save').click();
  await expect(page.getByTestId('venue-hours-message')).toContainText(`Saved hours for ${DATA.chicago}`);

  const monday = await timesOn('2099-09-07');
  expect(monday[0]).toBe('12:00 PM');
  expect(monday.at(-1)).toBe('5:30 PM');
  expect(await timesOn('2099-09-12')).toHaveLength(0); // Saturday is now closed
  expect(await timesOn('2099-09-09')).toHaveLength(0); // the new holiday
  expect((await timesOn('2099-09-08')).length).toBeGreaterThan(0); // Tuesday is untouched
});

test('a removed holiday and a reopened day offer times again', async ({ page }) => {
  expect(await timesOn('2099-12-25')).toHaveLength(0);
  expect(await timesOn('2099-09-06')).toHaveLength(0); // Sunday

  await openHours(page);
  await page.getByTestId('holiday-2099-12-25').locator('..').getByRole('button', { name: 'Remove' }).click();
  await page.getByTestId('hours-closed-sunday').uncheck();
  await page.getByTestId('hours-save').click();
  await expect(page.getByTestId('venue-hours-message')).toContainText(`Saved hours for ${DATA.chicago}`);

  expect((await timesOn('2099-12-25')).length).toBeGreaterThan(0);
  expect((await timesOn('2099-09-06')).length).toBeGreaterThan(0);
});
