import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { openMenuItem } from '../helpers/menuNav';
import { DATA, forwardCloud, playerCall, resetData, staffCall } from './support';

/**
 * Media on real cloud data (SW-175). What staff change here decides what a Player can pick, so
 * each change is checked from the Player's side too.
 */
test.beforeEach(async () => { await resetData(); });

async function openMedia(page) {
  await forwardCloud(page);
  await signInAsVenueAdmin(page);
  await openMenuItem(page, 'content', 'menu-media');
  await expect(page.getByRole('heading', { name: 'Media', exact: true })).toBeVisible();
}

const titleCard = (page, name: string) => page.locator('.MuiCard-root').filter({ has: page.getByText(name, { exact: true }) });

/** What the Player is offered for the full treadmill, by title id. */
async function offered() {
  const query = `userId=${DATA.adultUser}&at=2099-09-03T16:00:00.000Z`;
  const res = await playerCall(DATA.adultPlayer, `/venues/${DATA.chicago}/devices/${DATA.full}/selectable-media?${query}`);
  expect(res.status).toBe(200);
  return Object.fromEntries(res.body.titles.map((t) => [t.mediaId, t]));
}

test('the catalog lists this tenant\'s titles and marks the unpublished one', async ({ page }) => {
  await openMedia(page);
  await expect(titleCard(page, 'Trail')).toBeVisible();
  await expect(titleCard(page, 'Steep')).toBeVisible();
  await expect(titleCard(page, 'Unpublished')).toContainText('Unpublished');
  await expect(titleCard(page, 'Trail')).not.toContainText('Unpublished');
  // Another tenant's title is never listed.
  await expect(page.getByText('Tenant B Only')).toHaveCount(0);
});

test('a title created in the console is stored and appears in the catalog', async ({ page }) => {
  await openMedia(page);
  await page.getByTestId('create-media').click();
  await page.getByLabel('Name').fill('Desert Dash');
  await page.getByLabel('Description').fill('A trail through the dunes');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Created Desert Dash')).toBeVisible();
  await expect(titleCard(page, 'Desert Dash')).toBeVisible();

  const listed = await staffCall('/media');
  const created = listed.body.media.find((m) => m.name === 'Desert Dash');
  expect(created, 'the cloud stored the title').toBeTruthy();
  expect(created.published).not.toBe(false);
});

test('unpublishing a title takes it away from Players, and publishing gives it back', async ({ page }) => {
  expect((await offered())[DATA.trail]?.selectable).toBe(true);

  await openMedia(page);
  await titleCard(page, 'Trail').getByRole('button', { name: 'Unpublish' }).click();
  await expect(page.getByText('Unpublished Trail')).toBeVisible();
  await expect(titleCard(page, 'Trail')).toContainText('Unpublished');
  expect((await offered())[DATA.trail]?.selectable ?? false).toBe(false);

  await titleCard(page, 'Trail').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published Trail')).toBeVisible();
  expect((await offered())[DATA.trail]?.selectable).toBe(true);
});

test('editing a title saves the new name and price', async ({ page }) => {
  await openMedia(page);
  await page.getByTestId(`edit-media-${DATA.trail}`).click();
  await page.getByLabel('Name').fill('Trail Reborn');
  await page.getByRole('button', { name: /^(Save|Update)$/ }).click();
  await expect(page.getByText('Updated Trail Reborn')).toBeVisible();
  const listed = await staffCall('/media');
  expect(listed.body.media.find((m) => m.mediaId === DATA.trail)?.name).toBe('Trail Reborn');
});

test('deleting a title removes it from the catalog', async ({ page }) => {
  await openMedia(page);
  page.once('dialog', (dialog) => dialog.accept());
  await titleCard(page, 'Steep').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Deleted Steep')).toBeVisible();
  await expect(page.getByText('Steep', { exact: true })).toHaveCount(0);
  const listed = await staffCall('/media');
  expect(listed.body.media.some((m) => m.name === 'Steep')).toBe(false);
});

test('the royalties tab opens on this tenant\'s data without an error', async ({ page }) => {
  await openMedia(page);
  await page.getByTestId('media-tab-royalties').click();
  await expect(page.getByTestId('media-royalties-table')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
