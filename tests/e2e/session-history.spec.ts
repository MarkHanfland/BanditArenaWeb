import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { mockCloudApi, createCloudFixture } from '../helpers/mockApis';
import { openMenuItem } from '../helpers/menuNav';

test('session history lists sessions and opens detail export', async ({ page }) => {
  await mockCloudApi(page, createCloudFixture());
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'operations', 'menu-sessions');
  await expect(page.getByRole('heading', { name: 'Session History' })).toBeVisible();
  await page.getByTestId('session-history-user-filter').click();
  await page.getByRole('option', { name: 'Alex Runner' }).click();
  await expect(page.getByTestId('session-history-table')).toBeVisible();
  await expect(page.getByText('session-demo-001')).toBeVisible();
  await expect(page.getByText('Lab Bay 1').first()).toBeVisible();
  await expect(page.getByText('Bandit Arena Lab').first()).toBeVisible();

  await page.getByTestId('session-history-open-session-demo-001').click();
  await expect(page.getByTestId('session-history-detail')).toBeVisible();
  await expect(page.getByTestId('session-history-detail').getByText(/Safety events \(/)).toBeVisible();
  await expect(page.getByTestId('session-history-detail').getByText(/Treadmill: Lab Bay 1/)).toBeVisible();
  await expect(page.getByTestId('session-history-export')).toBeEnabled();
});

test('enrollment session history link opens Session History filtered to player', async ({ page }) => {
  await mockCloudApi(page, createCloudFixture());
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByRole('heading', { name: 'Enrollment / Check-In' })).toBeVisible();
  await page.getByTestId('session-history-user-demo-001').click();
  await expect(page.getByRole('heading', { name: 'Session History' })).toBeVisible();
  await expect(page.getByTestId('session-history-user-filter')).toHaveValue('user-demo-001');
  await expect(page.getByText('Alex Runner').first()).toBeVisible();
  await expect(page.getByTestId('session-history-table')).toBeVisible();
});

test('start session is disabled while a player session is active', async ({ page }) => {
  const { mockConsoleApis } = await import('../helpers/mockApis');
  const { selectEnrolledPlayer } = await import('../helpers/selectPlayer');
  await mockConsoleApis(page);
  await signInAsVenueAdmin(page);
  await selectEnrolledPlayer(page, /Alex Runner/, { userId: 'user-demo-001' });
  await page.getByTestId('header-session-start').click();
  await expect(page.getByTestId('menu-dashboard')).toHaveClass(/Mui-selected/);

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByTestId('start-session-user-demo-001')).toBeDisabled();
});
