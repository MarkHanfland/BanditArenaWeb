import { expect, test } from '@playwright/test';
import { signInAsVenueAdmin } from '../helpers/auth';
import { mockConsoleApis, createCloudFixture } from '../helpers/mockApis';
import { selectEnrolledPlayer } from '../helpers/selectPlayer';

test('device dashboard, user, treadmill, events, services, and config pages load', async ({ page }) => {
  await mockConsoleApis(page);
  await signInAsVenueAdmin(page);

  await expect(page.getByTestId('safety-control')).toBeVisible();
  await expect(page.getByTestId('safety-control')).toHaveText('Safety Stop');
  await expect(page.getByTestId('safety-control')).toBeDisabled();
  await expect(page.getByTestId('device-status-bar')).toBeVisible();
  await expect(page.getByTestId('header-player-select')).toBeVisible();
  await expect(page.getByTestId('header-session-start')).toBeVisible();
  await expect(page.getByTestId('dashboard-treadmill-state')).toHaveText('User Standby');
  await expect(page.getByTestId('dashboard-session-time')).toHaveText('—');
  await expect(page.getByText('OPENXR DRIVER')).toBeVisible();
  await expect(page.getByText('OPENXR RUNTIME')).toHaveCount(0);
  await expect(page.getByTestId('menu-user')).toBeDisabled();

  await selectEnrolledPlayer(page, /Alex Runner/, { userId: 'user-demo-001' });
  await expect(page.getByTestId('menu-user')).toBeEnabled();
  await expect(page.getByTestId('dashboard-session-time')).toHaveText('—');

  await page.getByTestId('menu-user').click();
  await expect(page.getByTestId('user-tab-pending')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pending session start' })).toBeVisible();
  await expect(page.getByTestId('player-select')).toBeVisible();

  await page.getByTestId('menu-treadmill').click();
  await expect(page.getByText('Treadmill Status')).toBeVisible();
  await expect(page.getByTestId('treadmill-status')).toHaveText('User Standby');

  await page.getByTestId('menu-events').click();
  await expect(page.getByText('Safety & Error Events')).toBeVisible();

  await page.getByTestId('menu-services').click();
  await expect(page.getByText('Service Health')).toBeVisible();

  await page.getByTestId('menu-config').click();
  await expect(page.getByText('System Configuration')).toBeVisible();
  await expect(page.getByTestId('config-save')).toBeVisible();
});

test('header session start and end for an enrolled player', async ({ page }) => {
  await mockConsoleApis(page);
  await signInAsVenueAdmin(page);

  await expect(page.getByTestId('dashboard-session-time')).toHaveText('—');
  await selectEnrolledPlayer(page, /Alex Runner/, { userId: 'user-demo-001' });
  await page.getByTestId('header-session-start').click();
  await expect(page.getByTestId('header-session-player')).toHaveText('Alex Runner');
  await expect(page.getByTestId('dashboard-session-time')).toHaveText(/\d+:\d{2}/);
  await expect(page.getByTestId('menu-user')).toBeEnabled();

  await page.getByTestId('menu-user').click();
  await expect(page.getByTestId('user-tab-active')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active session' })).toBeVisible();

  await page.getByTestId('header-session-end').click();
  await expect(page.getByTestId('header-player-select')).toBeVisible();
  await expect(page.getByTestId('menu-user')).toBeEnabled();
  await expect(page.getByTestId('dashboard-session-time')).toHaveText('—');
});

test('header session start stays disabled without high-confidence skeleton', async ({ page }) => {
  await mockConsoleApis(page, createCloudFixture(), {
    trackingReady: false,
    trackingConfidence: 0.1,
  });
  await signInAsVenueAdmin(page);

  await expect(page.getByTestId('header-session-tracking-blocked')).toHaveText(
    'Waiting for high-confidence skeleton tracking',
  );
  await expect(page.getByTestId('header-session-start')).toBeDisabled();

  await selectEnrolledPlayer(page, /Alex Runner/, { userId: 'user-demo-001' });
  await expect(page.getByTestId('header-session-start')).toBeDisabled();
});

test('player select dialog searches by last name and shows scheduled filter', async ({ page }) => {
  await mockConsoleApis(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('header-player-select').click();
  const dialog = page.getByTestId('header-player-select-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('header-player-select-dialog-scheduled-only')).toBeChecked();
  await expect(page.getByTestId('header-player-select-dialog-row-user-demo-001')).toBeVisible();
  await expect(page.getByText('Scheduled').first()).toBeVisible();

  await page.getByTestId('header-player-select-dialog-search').fill('Runner');
  await expect(page.getByTestId('header-player-select-dialog-row-user-demo-001')).toBeVisible();

  await page.getByTestId('header-player-select-dialog-row-user-demo-001').click();
  await expect(page.getByTestId('header-player-select-dialog-details')).toContainText('Alex Runner');
  await expect(page.getByTestId('header-player-select-dialog-details')).toContainText('alex.runner@example.com');

  await page.getByTestId('header-player-select-dialog-confirm').click();
  await expect(page.getByTestId('header-player-select')).toHaveValue(/Alex Runner/);
});
