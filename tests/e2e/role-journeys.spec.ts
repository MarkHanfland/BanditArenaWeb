import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/auth';
import { mockConsoleApis } from '../helpers/mockApis';
import { expandMenuGroup } from '../helpers/menuNav';

// Role-journey acceptance (PM review, FR-SW-UI-014 / FR-SW-UI-017 / FR-SW-UI-018).
// Each role lands on the screen its job needs, and sees only the chrome it can use.

test.describe('device chrome is limited to roles that hold a Local Device menu', () => {
  for (const roleId of ['frontDesk', 'accountOwner', 'billingAdmin'] as const) {
    test(`${roleId} sees no device status band and no Safety Stop`, async ({ page }) => {
      await mockConsoleApis(page);
      await signInAs(page, roleId);
      await expect(page.getByTestId('sign-out')).toBeVisible();
      await expect(page.getByTestId('device-status-band')).toHaveCount(0);
      await expect(page.getByTestId('header-player-select')).toHaveCount(0);
      await expect(page.getByTestId('header-session-start')).toHaveCount(0);
      await expect(page.getByTestId('safety-control')).toHaveCount(0);
    });
  }

  for (const roleId of ['operator', 'venueAdmin'] as const) {
    test(`${roleId} keeps the device status band and Safety Stop`, async ({ page }) => {
      await mockConsoleApis(page);
      await signInAs(page, roleId);
      await expect(page.getByTestId('device-status-bar')).toBeVisible();
      await expect(page.getByTestId('safety-control')).toBeVisible();
    });
  }
});

test.describe('safety stop is unmistakable', () => {
  test('a stopped belt shows a full-width banner and a red treadmill state', async ({ page }) => {
    await mockConsoleApis(page, undefined, { treadmillState: 3 });
    await signInAs(page, 'operator');
    const banner = page.getByTestId('safety-stop-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('SAFETY STOP');
    await expect(page.getByTestId('dashboard-treadmill-state')).toHaveCSS('color', 'rgb(255, 82, 82)');
  });

  test('no banner while the belt is operating', async ({ page }) => {
    await mockConsoleApis(page, undefined, { treadmillState: 2 });
    await signInAs(page, 'operator');
    await expect(page.getByTestId('device-status-bar')).toBeVisible();
    await expect(page.getByTestId('safety-stop-banner')).toHaveCount(0);
  });

  test('Safety Stop stays on one line and visible at tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await mockConsoleApis(page, undefined, { treadmillState: 2 });
    await signInAs(page, 'venueAdmin');
    const stop = page.getByTestId('safety-control');
    await expect(stop).toBeVisible();
    const box = await stop.boundingBox();
    expect(box, 'Safety Stop has a layout box').not.toBeNull();
    // One line of text: a wrapped label would roughly double the height.
    expect(box!.height).toBeLessThan(40);
    const viewport = page.viewportSize()!;
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  });
});

test.describe('customer billing roles land on their own invoices', () => {
  for (const roleId of ['accountOwner', 'billingAdmin'] as const) {
    test(`${roleId} opens Payments & Billing on Invoices, not Bandit's price list`, async ({ page }) => {
      await mockConsoleApis(page);
      await page.route('**/billing/invoices', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoices: [{
            invoiceId: 'inv-e2e-001',
            createdAt: new Date().toISOString(),
            totalUsd: 1250,
            status: 'issued',
            downloadUrl: 'https://billing.local/invoices/inv-e2e-001.pdf',
          }],
        }),
      }));
      await signInAs(page, roleId);
      await expandMenuGroup(page, 'business');
      await page.getByTestId('menu-billing').click();
      await expect(page.getByRole('heading', { name: 'Payments & Billing' })).toBeVisible();
      await expect(page.getByTestId('commerce-tab-invoices')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('billing-invoices-table')).toContainText('inv-e2e-001');
      await expect(page.getByTestId('commerce-tab-models')).toHaveCount(0);
    });
  }

  test('cloud admin still sees the internal Commerce page', async ({ page }) => {
    await mockConsoleApis(page);
    await signInAs(page, 'cloudAdmin');
    await expandMenuGroup(page, 'business');
    await page.getByTestId('menu-billing').click();
    await expect(page.getByRole('heading', { name: 'Commerce' })).toBeVisible();
    await expect(page.getByTestId('commerce-tab-invoices')).toHaveCount(0);
  });
});
