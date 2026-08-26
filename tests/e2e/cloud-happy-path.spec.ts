import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInAsVenueAdmin } from '../helpers/auth';
import { createCloudFixture, mockCloudApi, mockConsoleApis } from '../helpers/mockApis';
import { openMenuItem } from '../helpers/menuNav';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('enrollment happy path: list users and add user', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByText('Alex Runner')).toBeVisible();
  await page.getByTestId('add-user').click();
  await page.getByTestId('add-user-name').fill('New Demo User');
  await page.getByTestId('add-user-email').fill('new.demo@example.com');
  await expect(page.getByTestId('add-user-submit')).toBeDisabled();
  await page.getByTestId('add-user-age').check();
  await page.getByTestId('add-user-submit').click();
  await expect(page.getByText('Created New Demo User')).toBeVisible();
});

test('enrollment activate then start session for a pending user', async ({ page }) => {
  const fixture = createCloudFixture();
  await mockConsoleApis(page, fixture);
  await signInAsVenueAdmin(page);

  // Wait for device ping + media auto-select before Users page startSession.
  await expect(page.getByTestId('header-media-select')).toHaveValue(/Alpine Trail/);

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByText('Jordan Pending')).toBeVisible();
  await page.getByTestId('activate-user-demo-002').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Jordan Pending is now active');

  await page.getByTestId('start-session-user-demo-002').click();
  // Start Session navigates to Dashboard (FR-SW-UI-001).
  await expect(page.getByTestId('menu-dashboard')).toHaveClass(/Mui-selected/);
  await expect(page.getByTestId('header-session-end')).toBeVisible();
  await expect(page.getByTestId('header-player-select')).toHaveValue(/Jordan Pending/);
});

test('enrollment suspend blocks a later cloud session start', async ({ page }) => {
  const fixture = createCloudFixture();
  await mockCloudApi(page, fixture);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'operations', 'menu-users');
  await page.getByTestId('suspend-user-demo-001').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Alex Runner is now suspended');
  await page.getByTestId('start-session-user-demo-001').click();
  await expect(page.getByTestId('enrollment-message')).toContainText('Session blocked: enrollment not active');
});

test('session start on the device console starts the local session for an active user', async ({ page }) => {
  await mockConsoleApis(page);
  await signInAsVenueAdmin(page);

  await expect(page.getByTestId('header-media-select')).toHaveValue(/Alpine Trail/);

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByText('Alex Runner')).toBeVisible();
  await page.getByTestId('start-session-user-demo-001').click();
  await expect(page.getByTestId('menu-dashboard')).toHaveClass(/Mui-selected/);
  await expect(page.getByTestId('header-session-end')).toBeVisible();
  await expect(page.getByTestId('header-player-select')).toHaveValue(/Alex Runner/);
});

test('session start is blocked by the license gate for a non-active user', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'operations', 'menu-users');
  await expect(page.getByText('Jordan Pending')).toBeVisible();
  await page.getByTestId('start-session-user-demo-002').click();
  await expect(page.getByText('Session blocked: enrollment not active')).toBeVisible();
});

test('content publish flow adds a VR title', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'content', 'menu-media');
  await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible();
  await page.getByTestId('create-media').click();
  await page.getByLabel('Name').fill('Desert Dash');
  await page.getByLabel('Description').fill('A demo VR trail');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(/Created Desert Dash|Desert Dash/)).toBeVisible();
});

test('SW-089: media cover upload uses asset-upload-token and objectKey PATCH only', async ({
  page,
}) => {
  const fixture = createCloudFixture();
  await mockCloudApi(page, fixture);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'content', 'menu-media');
  await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible();
  await page.getByTestId('edit-media-m1').click();

  const coverPath = path.join(__dirname, '../fixtures/cover-sw089.png');
  expect(fs.existsSync(coverPath)).toBeTruthy();

  await page.getByTestId('upload-media-image-input').setInputFiles(coverPath);
  await expect(page.getByText('Image uploaded')).toBeVisible();

  expect(fixture.lastMediaPatch).toBeTruthy();
  expect(fixture.lastMediaPatch?.mediaId).toBe('m1');
  const patchBody = fixture.lastMediaPatch?.body || {};
  expect(patchBody.imageObjectKey).toMatch(/^media-assets\/m1\/image\//);
  expect(patchBody.image).toBeUndefined();
  expect(JSON.stringify(patchBody)).not.toMatch(/data:image/);

  const m1 = fixture.media.find((entry) => entry.mediaId === 'm1');
  expect(m1?.imageObjectKey).toBe(patchBody.imageObjectKey);
  expect(String(m1?.image || '')).toContain('signed.mock.local');
  expect(String(m1?.image || '')).not.toMatch(/^data:/);

  await expect(page.locator('img[alt="Preview"]')).toHaveAttribute(
    'src',
    /signed\.mock\.local|blob:/,
  );
});

test('fleet register flow provisions a device', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'device-fleet', 'menu-fleet');
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
  await page.getByTestId('register-device').click();
  await page.getByTestId('register-compute-serial').fill('BA-COMPUTE-E2E-001');
  await page.getByTestId('register-device-submit').click();
  await expect(page.getByText(/Provisioned instance-new \(SN BA-COMPUTE-E2E-001\)/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One-time device credentials' })).toBeVisible();
  await page.getByTestId('credentials-dismiss').click();
});

test('fleet activate flow activates a provisioned device', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'device-fleet', 'menu-fleet');
  await page.getByTestId('fleet-row-i-provisioned').click();
  await page.getByRole('tab', { name: 'Lifecycle' }).click();
  await page.getByTestId('activate-i-provisioned').click();
  await expect(page.getByText('Activated i-provisioned')).toBeVisible();
});

test('reservation book flow confirms a slot and sets the next player', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'operations', 'menu-reservations');
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible();
  await page.getByTestId('book-slot-001').click();
  await expect(page.getByText(/Booked slot-001 for Alex Runner/)).toBeVisible();
  await expect(page.getByText(/Reminder queued/)).toBeVisible();
});

test('staff assign role records a venue operator', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'operations', 'menu-staff');
  await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();
  await page.getByTestId('staff-principal').fill('op@example.com');
  await page.getByTestId('staff-assign').click();
  await expect(page.getByTestId('staff-message')).toContainText('Assigned bandit-operator to op@example.com');
  await expect(page.getByRole('cell', { name: 'op@example.com' })).toBeVisible();
});

test('billing issue and revoke license', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'business', 'menu-billing');
  await expect(page.getByRole('heading', { name: 'Commerce' })).toBeVisible();
  await page.getByTestId('commerce-tab-licensing').click();
  await page.getByTestId('issue-license').click();
  await page.getByTestId('issue-license-submit').click();
  await expect(page.getByTestId('billing-message')).toContainText('Issued lic-new-2');
  await page.getByTestId('revoke-lic-demo-001').click();
  await expect(page.getByTestId('billing-message')).toContainText('Revoked lic-demo-001');
});

test('commerce offerings BOM and revenue tabs', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'business', 'menu-billing');
  await expect(page.getByTestId('commerce-offerings-table')).toBeVisible();
  await expect(page.getByText('BA-CORE-BUNDLE')).toBeVisible();
  await expect(page.getByText('BA-PRO-BUNDLE')).toBeVisible();

  await page.getByTestId('commerce-tab-models').click();
  await expect(page.getByTestId('commerce-bom-table')).toBeVisible();
  await expect(page.getByText('hw-compute')).toBeVisible();

  await page.getByTestId('commerce-tab-revenue').click();
  await expect(page.getByTestId('commerce-revenue')).toBeVisible();
  await expect(page.getByTestId('revenue-total')).toContainText('$63,488');
});

test('commerce spare order submits for a device', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'business', 'menu-billing');
  await page.getByTestId('commerce-create-order').click();
  // Default SKU is BA-SPARE-MEMBRANE; MUI Select puts data-testid on the hidden native input.
  await expect(page.getByTestId('order-sku')).toHaveValue('BA-SPARE-MEMBRANE');
  await page.getByTestId('order-submit').click();
  await expect(page.getByTestId('billing-message')).toContainText('Order ord-');
});

test('analytics page shows summary cards', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'analytics', 'menu-usage');
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Sessions (7d)')).toBeVisible();
  await expect(page.getByTestId('analytics-sessions')).toHaveText('5');
  await expect(page.getByTestId('analytics-trend')).toBeVisible();
  await expect(page.getByText('1 → 2 → 3')).toBeVisible();
});

test('SW-090: analytics alert ack and notification history', async ({ page }) => {
  const fixture = createCloudFixture();
  await mockCloudApi(page, fixture);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'analytics', 'menu-usage');
  await expect(page.getByTestId('analytics-alert-alert-001')).toBeVisible();
  await expect(page.getByText('Device i1 is offline')).toBeVisible();

  await page.getByTestId('ack-alert-alert-001').click();
  await expect(page.getByTestId('analytics-action-message')).toContainText(/Acknowledged|acknowledged/i);
  await expect(page.getByTestId('analytics-alerts-empty')).toBeVisible();
  expect(fixture.alerts.find((a) => a.alertId === 'alert-001')?.status).toBe('acknowledged');

  await page.getByTestId('send-session-reminder').click();
  await expect(page.getByTestId('notification-notif-1')).toBeVisible();
  await expect(page.getByTestId('analytics-notifications')).toContainText('session_reminder');
  expect(fixture.notifications.length).toBeGreaterThan(0);
});

test('maintenance records an event for the selected device', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'device-fleet', 'menu-fleet');
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
  await page.getByTestId('fleet-row-i1').click();
  await page.getByTestId('fleet-tab-maintenance').click();
  await page.getByTestId('record-maintenance').click();
  await page.getByLabel('Description').fill('Belt inspection');
  await page.getByTestId('maintenance-submit').click();
  await expect(page.getByText('Belt inspection')).toBeVisible();
});

test('fleet demo shows Neon Circuit map and financial rollup', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await openMenuItem(page, 'device-fleet', 'menu-fleet');
  await expect(page.getByTestId('fleet-map')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Neon Circuit' })).toBeVisible();
  await page.getByTestId('fleet-fleet-horizon-parks').click();
  await expect(page.getByRole('heading', { name: 'Horizon Parks' })).toBeVisible();
  await page.getByTestId('fleet-tab-financial').click();
  await expect(page.getByTestId('device-financials')).toBeVisible();
});
